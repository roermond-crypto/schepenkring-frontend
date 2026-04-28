"use client";

import React, { useState, useEffect, isValidElement, cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldHelpTooltip } from "@/components/yachts/FieldHelpTooltip";
import { BoatFieldSettingsLink } from "@/components/yachts/BoatFieldSettingsLink";
import { FieldHistoryPopover } from "@/components/yachts/FieldHistoryPopover";
import { FieldCorrectionControls, type CorrectionLabel } from "@/components/yachts/FieldCorrectionControls";

export const DESCRIPTION_LANGS = ["nl", "en", "de", "fr"] as const;
export type DescriptionLanguage = (typeof DESCRIPTION_LANGS)[number];
export type DescriptionTextState = Record<DescriptionLanguage, string>;

export const DESCRIPTION_LANGUAGE_BADGES: Record<DescriptionLanguage, string> = {
  nl: "🇳🇱 NL",
  en: "🇬🇧 EN",
  de: "🇩🇪 DE",
  fr: "🇫🇷 FR",
};

export const DESCRIPTION_LANGUAGE_LABELS: Record<DescriptionLanguage, string> = {
  nl: "Nederlandse Beschrijving",
  en: "English Description",
  de: "Deutsche Beschreibung",
  fr: "Description Francaise",
};

export const DESCRIPTION_LANGUAGE_LOCALES: Record<DescriptionLanguage, string> = {
  nl: "nl-NL",
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
};

import { useLocale } from "next-intl";

// Redefining some local constants/helpers that were in page.tsx
// These might need to be passed or imported if they grow complex
const isPlaceholderFieldText = (val: string) => 
  ["unknown", "n/a", "none", "tbd"].includes(val.toLowerCase());

const normalizeDomFieldValue = (val: any) => {
  if (val === null || val === undefined) return "";
  return String(val);
};

export const sanitizeScalarFieldValue = (val: any) => {
  if (val === null || val === undefined || val === "") return null;
  return val;
};

const normalizeTriStateValue = (val: any): "yes" | "no" | null => {
  if (val === "yes" || val === true || val === 1 || val === "1") return "yes";
  if (val === "no" || val === false || val === 0 || val === "0") return "no";
  return null;
};

export function isOptionalTriStateField(fieldName: string): boolean {
  return (OPTIONAL_TRI_STATE_FIELDS as readonly string[]).includes(fieldName);
}

// --- REUSED COMPONENTS ---

export function FieldLabel({
  label,
  helpText,
  yachtId,
  fieldName,
  className,
}: {
  label: string;
  helpText?: string | null;
  yachtId?: number | string;
  fieldName?: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className={className}>{label}</Label>
      <FieldHelpTooltip text={helpText} label={label} />
      <BoatFieldSettingsLink fieldName={fieldName} />
      {yachtId && fieldName ? (
        <FieldHistoryPopover
          yachtId={Number(yachtId)}
          fieldName={fieldName}
          label={label}
        />
      ) : null}
    </div>
  );
}

export function hasFilledFieldValue(
  value: unknown,
  options?: { treatUnknownAsEmpty?: boolean },
): boolean {
  const treatUnknownAsEmpty = options?.treatUnknownAsEmpty ?? false;

  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "object") {
    return sanitizeScalarFieldValue(value) !== null;
  }

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

export function WizardInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    needsConfirmation?: boolean;
    confidence?: number;
    showAdminEditLink?: boolean;
  },
) {
  const {
    needsConfirmation,
    confidence,
    showAdminEditLink = true,
    ...inputProps
  } = props;
  const fieldName =
    typeof inputProps.name === "string" ? inputProps.name : undefined;
  const shouldShowAdminEditLink =
    showAdminEditLink && typeof fieldName === "string" && fieldName !== "";
  const [liveValue, setLiveValue] = useState<string | null>(null);
  
  const normalizedInputProps =
    inputProps.type === "number"
      ? {
          inputMode: inputProps.inputMode ?? "decimal",
          step: inputProps.step ?? "any",
          ...inputProps,
        }
      : inputProps;

  const sanitizedValue = normalizeDomFieldValue(inputProps.value);
  const sanitizedDefaultValue = normalizeDomFieldValue(inputProps.defaultValue);
  const hasValue = hasFilledFieldValue(
    sanitizedValue || liveValue || sanitizedDefaultValue,
  );
  const highlighted = Boolean(needsConfirmation) || hasValue;

  return (
    <div className="relative">
      <input
        {...normalizedInputProps}
        value={inputProps.value}
        defaultValue={inputProps.defaultValue}
        placeholder={undefined}
        onChange={(event) => {
          setLiveValue(event.target.value);
          inputProps.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          "placeholder:text-slate-400 placeholder:font-normal",
          shouldShowAdminEditLink && "pr-12",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          inputProps.className,
        )}
      />
      {shouldShowAdminEditLink && (
        <BoatFieldSettingsLink
          fieldName={fieldName}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        />
      )}
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ confirm
        </span>
      )}
    </div>
  );
}

export function SelectField(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    needsConfirmation?: boolean;
    treatUnknownAsEmpty?: boolean;
    showAdminEditLink?: boolean;
  },
) {
  const {
    needsConfirmation,
    treatUnknownAsEmpty = false,
    showAdminEditLink = true,
    defaultValue,
    value,
    onChange,
    className,
    children,
    ...selectProps
  } = props;
  const fieldName =
    typeof selectProps.name === "string" ? selectProps.name : undefined;
  const shouldShowAdminEditLink =
    showAdminEditLink && typeof fieldName === "string" && fieldName !== "";
  const sanitizedValue = normalizeDomFieldValue(value);
  const sanitizedDefaultValue = normalizeDomFieldValue(defaultValue);
  const [currentValue, setCurrentValue] = useState<string | null>(null);
  const effectiveCurrentValue =
    sanitizedValue || currentValue || sanitizedDefaultValue || "";

  const highlighted =
    Boolean(needsConfirmation) ||
    hasFilledFieldValue(effectiveCurrentValue, { treatUnknownAsEmpty });

  return (
    <div className="relative">
      <select
        {...selectProps}
        value={value}
        defaultValue={defaultValue ?? ""}
        onChange={(event) => {
          setCurrentValue(event.target.value);
          onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer",
          shouldShowAdminEditLink && "pr-16",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          className,
        )}
      >
        {children}
      </select>
      {shouldShowAdminEditLink && (
        <BoatFieldSettingsLink
          fieldName={fieldName}
          className="absolute right-9 top-1/2 -translate-y-1/2"
        />
      )}
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ confirm
        </span>
      )}
    </div>
  );
}

export function YachtFieldWrapper({
  children,
  label,
  yachtId,
  fieldName,
  helpText,
  correctionLabel,
  onCorrectionLabelChange,
}: {
  children: React.ReactNode;
  label: string;
  yachtId?: number | string;
  fieldName: string;
  helpText?: string | null;
  correctionLabel?: CorrectionLabel | null;
  onCorrectionLabelChange?: (label: CorrectionLabel | null) => void;
}) {
  const isCorrection = correctionLabel !== undefined;
  const childWithSettingsLinkSuppressed =
    isValidElement(children) && typeof children.type !== "string"
      ? cloneElement(
          children as React.ReactElement<{ showAdminEditLink?: boolean }>,
          {
            showAdminEditLink: false,
          },
        )
      : children;

  return (
    <div className="space-y-2 group">
      <FieldLabel
        label={label}
        helpText={helpText}
        yachtId={yachtId}
        fieldName={fieldName}
      />
      {childWithSettingsLinkSuppressed}
      {isCorrection && onCorrectionLabelChange && (
        <FieldCorrectionControls
          activeLabel={correctionLabel}
          onSelect={(label) => onCorrectionLabelChange(label)}
          onClear={() => onCorrectionLabelChange(null)}
        />
      )}
    </div>
  );
}

export function TriStateSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    needsConfirmation?: boolean;
    yachtId?: number | string;
    fieldName?: string;
    label?: string;
    showAdminEditLink?: boolean;
    yesLabel?: string;
    noLabel?: string;
    unknownLabel?: string;
    confirmLabel?: string;
  },
) {
  const {
    needsConfirmation,
    defaultValue,
    yachtId,
    fieldName,
    label,
    showAdminEditLink = true,
    yesLabel = "Yes",
    noLabel = "No",
    unknownLabel = "Unknown",
    confirmLabel = "Confirm",
    ...selectProps
  } = props;

  const locale = useLocale();
  const defaultYes = locale === "nl" ? "Ja" : locale === "de" ? "Ja" : locale === "fr" ? "Oui" : "Yes";
  const defaultNo = locale === "nl" ? "Nee" : locale === "de" ? "Nein" : locale === "fr" ? "Non" : "No";
  const defaultUnknown = locale === "nl" ? "Onbekend" : locale === "de" ? "Unbekannt" : locale === "fr" ? "Inconnu" : "Unknown";
  const defaultConfirm = locale === "nl" ? "Controleren" : locale === "de" ? "Prüfen" : locale === "fr" ? "Vérifier" : "Confirm";

  const shouldShowAdminEditLink =
    showAdminEditLink && typeof fieldName === "string" && fieldName !== "";
  const normalizedDefault = normalizeTriStateValue(
    sanitizeScalarFieldValue(defaultValue),
  );
  const [currentValue, setCurrentValue] = useState<"yes" | "no" | null>(
    normalizedDefault,
  );

  useEffect(() => {
    setCurrentValue(normalizedDefault);
  }, [normalizedDefault]);

  const highlighted =
    Boolean(needsConfirmation) ||
    hasFilledFieldValue(currentValue, { treatUnknownAsEmpty: true });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-1">
        {yachtId && fieldName && label && !selectProps.children && (
          <FieldHistoryPopover
            yachtId={Number(yachtId)}
            fieldName={fieldName}
            label={label}
          />
        )}
      </div>
      <select
        {...selectProps}
        defaultValue={normalizedDefault ?? ""}
        onChange={(event) => {
          setCurrentValue(normalizeTriStateValue(event.target.value));
          selectProps.onChange?.(event);
        }}
        className={cn(
          "w-full bg-white border rounded-md px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
          "hover:border-slate-300",
          "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
          shouldShowAdminEditLink && "pr-16",
          highlighted ? "border-amber-300 bg-amber-50/50" : "border-slate-200",
          selectProps.className,
        )}
      >
        <option value=""></option>
        <option value="yes">{props.yesLabel || defaultYes}</option>
        <option value="no">{props.noLabel || defaultNo}</option>
        <option value="unknown">{props.unknownLabel || defaultUnknown}</option>
      </select>
      {shouldShowAdminEditLink && (
        <BoatFieldSettingsLink
          fieldName={fieldName}
          className="absolute right-9 top-1/2 -translate-y-1/2"
        />
      )}
      {needsConfirmation && (
        <span className="absolute -top-2 right-2 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          ⚠ {props.confirmLabel || defaultConfirm}
        </span>
      )}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    </div>
  );
}

export function AiEvidenceHover({
  field,
  evidence,
  children,
  label,
}: {
  field: string;
  evidence: { imageUrl: string; confidence?: number } | undefined;
  children: React.ReactNode;
  label: string;
}) {
  const [show, setShow] = useState(false);
  if (!evidence?.imageUrl) return <>{children}</>;
  return (
    <div
      className="relative inline-block w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-full top-0 z-50 ml-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <p className="text-[9px] font-black uppercase text-slate-600 mb-1.5">
            AI evidence – {label}
            {evidence.confidence != null && ` (${evidence.confidence}%)`}
          </p>
          <img
            src={evidence.imageUrl}
            alt="AI source"
            className="w-full aspect-video object-cover rounded border border-slate-100"
          />
        </div>
      )}
      <span className="absolute top-1 right-1 rounded bg-[#003566] text-white text-[7px] font-bold px-1.5 py-0.5">
        AI
      </span>
    </div>
  );
}
export function getConfigBlockExpansionKey(
  block: any,
  values: any,
  triStateFields: string[] | readonly string[],
): string {
  if (!block) return "empty";

  const fieldsToCheck = [
    ...(block.primary_fields || []),
    ...(block.secondary_fields || []),
  ];

  const valueSignature = fieldsToCheck
    .map((f: any) => {
      const val = values?.[f.internal_key];
      const hasValue = hasFilledFieldValue(val, {
        treatUnknownAsEmpty:
          f.field_type === "tri_state" || triStateFields.includes(f.internal_key),
      });
      return hasValue ? "1" : "0";
    })
    .join("");

  return `${block.id}-${valueSignature}`;
}

export const OPTIONAL_TRI_STATE_FIELDS = [
  "life_jackets",
  "bimini",
  "anchor",
  "fishfinder",
  "bow_thruster",
  "trailer",
  "heating",
  "toilet",
  "fridge",
  "shower",
  "bath",
  "oven",
  "microwave",
  "freezer",
  "television",
  "ais",
  "radar",
  "bilge_pump",
  "bilge_pump_manual",
  "bilge_pump_electric",
  "fire_extinguisher",
  "mob_system",
  "radar_reflector",
  "flares",
  "life_buoy",
  "watertight_door",
  "gas_bottle_locker",
  "self_draining_cockpit",
  "compass",
  "autopilot",
  "gps",
  "vhf",
  "plotter",
  "rudder_position_indicator",
  "turn_indicator",
  "ssb_receiver",
  "shortwave_radio",
  "short_band_transmitter",
  "satellite_communication",
  "weatherfax_navtex",
  "charts_guides",
  "battery",
  "battery_charger",
  "generator",
  "inverter",
  "shorepower",
  "solar_panel",
  "wind_generator",
  "dynamo",
  "accumonitor",
  "voltmeter",
  "shore_power_cable",
  "consumption_monitor",
  "control_panel",
  "fuel_tank_gauge",
  "tachometer",
  "oil_pressure_gauge",
  "temperature_gauge",
  "water_tank",
  "water_tank_gauge",
  "water_maker",
  "waste_water_tank",
  "waste_water_tank_gauge",
  "waste_water_tank_drainpump",
  "deck_suction",
  "water_system",
  "hot_water",
  "sea_water_pump",
  "deck_wash_pump",
  "deck_shower",
  "hot_air",
  "stove",
  "central_heating",
  "anchor_winch",
  "spray_hood",
  "swimming_platform",
  "swimming_ladder",
  "teak_deck",
  "cockpit_table",
  "dinghy",
  "trailer",
  "covers",
  "fenders",
  "stern_anchor",
  "spud_pole",
  "cockpit_tent",
  "outdoor_cushions",
  "sea_rails",
  "pushpit_pullpit",
  "sail_lowering_system",
  "crutch",
  "davits",
  "bowsprit",
  "main_sail",
  "furling_mainsail",
  "jib",
  "genoa",
  "spinnaker",
  "gennaker",
  "mizzen",
  "winches",
  "electric_winches",
] as const;
