"use client";

import React from "react";
import { 
  Calendar, 
  Clock, 
  Settings2,
  ShieldCheck,
  Eye,
  Info,
  CheckCircle2
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AvailabilityRule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

interface SchedulingSettings {
  booking_min_notice_days: string | number;
  booking_max_days_ahead: string | number;
  booking_duration_minutes: string | number;
  booking_max_appointments_per_day: string | number;
  booking_requires_manual_approval: boolean;
  booking_send_confirmation_email: boolean;
  booking_allow_rescheduling: boolean;
  booking_reschedule_cutoff_hours: string | number;
  booking_allow_cancellations: boolean;
  booking_cancellation_cutoff_hours: string | number;
  booking_allow_instant: boolean;
}

interface WizardStep4Props {
  schedulingSettings: SchedulingSettings;
  updateSchedulingSetting: (field: string, value: string | boolean) => void;
  schedulingPreview: Array<{ date: Date; slots: string[]; totalSlots: number }>;
  availabilityRules: AvailabilityRule[];
  addAvailabilityRule: () => void;
  updateAvailabilityRule: (index: number, field: keyof AvailabilityRule, value: any) => void;
  removeAvailabilityRule: (index: number) => void;
  labelText: (key: any, fallback: string) => any;
  locale: string;
  t: any; // i18next dictionary
}

const MIN_NOTICE_OPTIONS = [
  { value: "0", labels: { en: "Same day", nl: "Dezelfde dag", de: "Am selben Tag" } },
  { value: "1", labels: { en: "1 day", nl: "1 dag", de: "1 Tag" } },
  { value: "2", labels: { en: "2 days", nl: "2 dagen", de: "2 Tage" } },
  { value: "3", labels: { en: "3 days", nl: "3 dagen", de: "3 Tage" } },
  { value: "7", labels: { en: "1 week", nl: "1 week", de: "1 Woche" } },
];

const MAX_AHEAD_OPTIONS = [
  { value: "30", labels: { en: "30 days", nl: "30 dagen", de: "30 Tage" } },
  { value: "60", labels: { en: "60 days", nl: "60 dagen", de: "60 Tage" } },
  { value: "90", labels: { en: "90 days", nl: "90 dagen", de: "90 Tage" } },
  { value: "180", labels: { en: "180 days", nl: "180 dagen", de: "180 Tage" } },
  { value: "365", labels: { en: "1 year", nl: "1 jaar", de: "1 Jahr" } },
];

const APPOINTMENT_DURATION_OPTIONS = [
  { value: "15", labels: { en: "15 minutes", nl: "15 minuten", de: "15 Minuten" } },
  { value: "30", labels: { en: "30 minutes", nl: "30 minuten", de: "30 Minuten" } },
  { value: "45", labels: { en: "45 minutes", nl: "45 minuten", de: "45 Minuten" } },
  { value: "60", labels: { en: "60 minuten", nl: "60 minuten", de: "60 Minuten" } },
  { value: "90", labels: { en: "90 minutes", nl: "90 minuten", de: "90 Minuten" } },
  { value: "120", labels: { en: "120 minutes", nl: "120 minuten", de: "120 Minuten" } },
];

const MAX_APPOINTMENTS_OPTIONS = [
  { value: "1", labels: { en: "1 per day", nl: "1 per dag", de: "1 pro Tag" } },
  { value: "2", labels: { en: "2 per day", nl: "2 per dag", de: "2 pro Tag" } },
  { value: "3", labels: { en: "3 per day", nl: "3 per dag", de: "3 pro Tag" } },
  { value: "5", labels: { en: "5 per dag", nl: "5 per dag", de: "5 pro Tag" } },
  { value: "10", labels: { en: "10 per dag", nl: "10 per dag", de: "10 pro Tag" } },
  { value: "unlimited", labels: { en: "Unlimited", nl: "Onbeperkt", de: "Unbegrenzt" } },
];

const OPTIONAL_CUTOFF_OPTIONS = [
  { value: "none", labels: { en: "No cutoff", nl: "Geen limiet", de: "Kein Limit" } },
  { value: "1", labels: { en: "1 hour before", nl: "1 uur van tevoren", de: "1 Stunde vorher" } },
  { value: "2", labels: { en: "2 hours before", nl: "2 uur van tevoren", de: "2 Stunden vorher" } },
  { value: "4", labels: { en: "4 hours before", nl: "4 uur van tevoren", de: "4 Stunden vorher" } },
  { value: "8", labels: { en: "8 hours before", nl: "8 uur van tevoren", de: "8 Stunden vorher" } },
  { value: "12", labels: { en: "12 hours before", nl: "12 uur van tevoren", de: "12 Stunden vorher" } },
  { value: "24", labels: { en: "24 hours before", nl: "24 uur van tevoren", de: "24 Stunden vorher" } },
  { value: "48", labels: { en: "48 hours before", nl: "48 uur van tevoren", de: "48 Stunden vorher" } },
];

export function WizardStep4({
  schedulingSettings,
  updateSchedulingSetting,
  schedulingPreview,
  availabilityRules,
  updateAvailabilityRule,
  labelText,
  locale,
  t,
}: WizardStep4Props) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  
  const getLabel = (option: any) => {
    if (locale === "nl") return option.labels.nl;
    if (locale === "de") return option.labels.de;
    return option.labels.en;
  };

  const getDayName = (day: number) => {
    const names: Record<number, string> = {
      1: t?.weekdays?.monday || "Monday",
      2: t?.weekdays?.tuesday || "Tuesday",
      3: t?.weekdays?.wednesday || "Wednesday",
      4: t?.weekdays?.thursday || "Thursday",
      5: t?.weekdays?.friday || "Friday",
      6: t?.weekdays?.saturday || "Saturday",
      0: t?.weekdays?.sunday || "Sunday",
    };
    return names[day];
  };

  return (
    <div className="space-y-10 bg-[#f8fafc] p-6 lg:p-12 border border-slate-200 animate-in fade-in duration-500">
      
      {/* ── HEADER ── */}
      <div className="space-y-2">
        <h3 className="text-[13px] font-black uppercase text-[#003566] tracking-[0.3em] flex items-center gap-3 italic">
          <Calendar size={22} className="text-blue-600" /> 04. PLANNING
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
          Laat klanten eenvoudig een bezichtiging inplannen. Geef aan op welke dagen en tijden u beschikbaar bent.
          <br />
          <span className="opacity-70 italic text-[11px]">De belangrijkste standaardinstellingen staan al goed, en extra opties blijven netjes onder geavanceerde instellingen.</span>
        </p>
      </div>

      {/* ── SECTION 1: BASISINSTELLINGEN ── */}
      <div className="space-y-6">
        <h4 className="text-sm font-bold text-slate-800">Basisinstellingen planning</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Min. dagen voor boeken", field: "booking_min_notice_days", options: MIN_NOTICE_OPTIONS },
            { label: "Max. dagen vooruit boeken", field: "booking_max_days_ahead", options: MAX_AHEAD_OPTIONS },
            { label: "Duur afspraak", field: "booking_duration_minutes", options: APPOINTMENT_DURATION_OPTIONS },
            { label: "Maximaal aantal afspraken per dag", field: "booking_max_appointments_per_day", options: MAX_APPOINTMENTS_OPTIONS },
          ].map((item) => (
            <div key={item.field} className="bg-white border border-slate-200 p-4 shadow-sm space-y-3">
              <Label className="text-[11px] font-bold text-slate-600">{item.label}</Label>
              <select
                value={schedulingSettings[item.field as keyof SchedulingSettings] as string}
                onChange={(e) => updateSchedulingSetting(item.field, e.target.value)}
                className="w-full h-10 bg-transparent border-b border-slate-200 text-sm font-bold text-[#003566] focus:border-blue-500 outline-none transition-all"
              >
                {item.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{getLabel(opt)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: GEAVANCEERDE INSTELLINGEN ── */}
      <div className="bg-white border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-800 uppercase tracking-wide">Geavanceerde instellingen</p>
          <p className="text-xs text-slate-500">Gebruik deze opties als u meer controle wilt over goedkeuring, e-mail, verplaatsen en annuleren.</p>
        </div>
        <button 
          type="button"
          onClick={() => {}} // Toggle advanced visibility
          className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#003566] transition-colors border-b-2 border-slate-200 pb-1"
        >
          GEAVANCEERDE INSTELLINGEN
        </button>
      </div>

      {/* ── SECTION 3: PREVIEW ── */}
      <div className="space-y-6">
        <h4 className="text-sm font-bold text-slate-800">Preview voor klant</h4>
        <div className="bg-white border border-slate-200 p-8 shadow-sm">
          <p className="text-xs text-slate-400 mb-6 italic">Deze preview volgt de bootinstellingen hieronder. Bestaande boekingen kunnen bezette tijden nog blokkeren.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isMounted && schedulingPreview.map((day, dIdx) => (
              <div key={dIdx} className="bg-slate-50/50 border border-slate-100 p-5 rounded-lg space-y-4">
                <div className="pb-2 border-b border-slate-200 flex justify-between items-center">
                  <p className="text-sm font-black text-[#003566]">
                    {day.date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  {day.slots.map((slot, sIdx) => (
                    <div 
                      key={sIdx} 
                      className="h-8 bg-white border border-green-100 rounded flex items-center justify-center text-[10px] font-black text-green-600 shadow-sm"
                    >
                      {slot}
                    </div>
                  ))}
                </div>
                {day.totalSlots > 4 && (
                  <p className="text-[10px] font-bold text-slate-400 italic">
                    + {day.totalSlots - 4} extra slots
                  </p>
                )}
              </div>
            ))}
            {!isMounted && (
              <div className="col-span-3 h-32 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: AVAILABILITY RULES (7 DAYS) ── */}
      <div className="space-y-4">
        {availabilityRules.map((rule, idx) => (
          <div
            key={rule.day_of_week}
            className={cn(
              "flex flex-wrap items-center gap-8 bg-white p-6 border border-slate-200 shadow-sm transition-all",
              !rule.enabled && "opacity-50 grayscale bg-slate-50"
            )}
          >
            <div className="w-40 space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Dagen van de week</Label>
              <p className="text-sm font-black text-[#003566]">{getDayName(rule.day_of_week)}</p>
            </div>

            <div className="flex items-center gap-3 w-32">
              <input
                type="checkbox"
                id={`day-${rule.day_of_week}`}
                checked={rule.enabled}
                onChange={(e) => updateAvailabilityRule(idx, "enabled", e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded"
              />
              <Label htmlFor={`day-${rule.day_of_week}`} className="text-xs font-bold text-slate-600 cursor-pointer">
                Beschikbaar
              </Label>
            </div>

            <div className="flex-1 min-w-[150px] space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Starttijd</Label>
              <div className="flex items-center gap-2 border-b-2 border-slate-100 py-1 focus-within:border-blue-500 transition-colors">
                <Clock size={14} className="text-slate-300" />
                <input
                  type="time"
                  step="900"
                  value={rule.start_time}
                  disabled={!rule.enabled}
                  onChange={(e) => updateAvailabilityRule(idx, "start_time", e.target.value)}
                  className="bg-transparent text-sm font-black text-[#003566] outline-none w-full disabled:text-slate-300"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[150px] space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Eindtijd</Label>
              <div className="flex items-center gap-2 border-b-2 border-slate-100 py-1 focus-within:border-blue-500 transition-colors">
                <Clock size={14} className="text-slate-300" />
                <input
                  type="time"
                  step="900"
                  value={rule.end_time}
                  disabled={!rule.enabled}
                  onChange={(e) => updateAvailabilityRule(idx, "end_time", e.target.value)}
                  className="bg-transparent text-sm font-black text-[#003566] outline-none w-full disabled:text-slate-300"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* ── FOOTER ACTIONS ── */}
      <div className="flex items-center justify-center gap-4 py-4">
        <CheckCircle2 size={20} className="text-green-500" />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 italic">
          Planning wordt automatisch opgeslagen
        </span>
      </div>
    </div>
  );
}
