"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import {
  AlertCircle,
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers3,
  PlayCircle,
  Plus,
  Sparkles,
  UserRound,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TriggerType =
  | "boat_created"
  | "boat_status_activated"
  | "booking_created"
  | "booking_completed"
  | "bid_accepted"
  | "deposit_paid"
  | "user_registered"
  | "harbor_created"
  | "contract_signed"
  | "escrow_funded"
  | "escrow_released"
  | "manual";
type ScheduleMode = "after" | "recurring" | "specific_date";
type AssigneeRule = "seller" | "harbor_user" | "creator" | "specific_user";
type RuleStatus = "draft" | "active";
type PriorityLevel = "Low" | "Medium" | "High";
type RelatedModelType =
  | "App\\Models\\Yacht"
  | "App\\Models\\Booking"
  | "App\\Models\\Deal";

interface AutomationRule {
  id: string;
  name: string;
  trigger: TriggerType;
  scheduleMode: ScheduleMode;
  offsetValue: string;
  offsetUnit: "hours" | "days" | "weeks" | "months";
  recurringEvery: string;
  recurringUnit: "days" | "weeks" | "months";
  specificDate: string;
  titleTemplate: string;
  bodyTemplate: string;
  priority: PriorityLevel;
  assigneeRule: AssigneeRule;
  specificUserId: string;
  relatedType: RelatedModelType;
  relatedBoatId: string;
  internalCode: string;
  status: RuleStatus;
}

const copyByLocale = {
  en: {
    badge: "Task Operations",
    title: "Scheduled Task Automation",
    subtitle:
      "Configure reminder rules and automated task creation for clients and employees.",
    backToTasks: "Back to Tasks",
    stats: {
      active: "Active rules",
      reminders: "Reminders due",
      templates: "Reusable templates",
    },
    sections: {
      builder: "Automation Builder",
      examples: "Starter Automations",
      preview: "Rule Preview",
      saved: "Configured Rules",
    },
    labels: {
      ruleName: "Rule name",
      trigger: "Trigger source",
      scheduleMode: "Schedule rule",
      offsetValue: "Delay",
      offsetUnit: "Delay unit",
      recurringEvery: "Repeat every",
      recurringUnit: "Repeat unit",
      specificDate: "Specific date",
      priority: "Priority",
      assigneeRule: "Assign to",
      specificUser: "Specific user",
      relatedType: "Related record type",
      relatedBoatId: "Related record",
      titleTemplate: "Task title template",
      bodyTemplate: "Task body template",
      internalCode: "Reference code",
    },
    hints: {
      after: "Creates the task after a delay from the selected trigger.",
      recurring: "Creates repeating reminders for follow-up workflows.",
      specificDate: "Useful for fixed campaign or compliance reminders.",
    },
    actions: {
      saveDraft: "Save Draft Rule",
      activate: "Activate Rule",
      activateNow: "Activate from Preview",
    },
    empty: "No automation rules configured yet.",
    active: "Active",
    draft: "Draft",
  },
  nl: {
    badge: "Taak Operaties",
    title: "Geplande Taak Automatisering",
    subtitle:
      "Configureer herinneringsregels en automatische taken voor klanten en medewerkers.",
    backToTasks: "Terug naar Taken",
    stats: {
      active: "Actieve regels",
      reminders: "Herinneringen vandaag",
      templates: "Herbruikbare templates",
    },
    sections: {
      builder: "Automatisering Builder",
      examples: "Start Automatiseringen",
      preview: "Regel Preview",
      saved: "Geconfigureerde Regels",
    },
    labels: {
      ruleName: "Regelnaam",
      trigger: "Trigger bron",
      scheduleMode: "Planning regel",
      offsetValue: "Vertraging",
      offsetUnit: "Vertraging eenheid",
      recurringEvery: "Herhaal elke",
      recurringUnit: "Herhaal eenheid",
      specificDate: "Specifieke datum",
      priority: "Prioriteit",
      assigneeRule: "Toewijzen aan",
      specificUser: "Specifieke gebruiker",
      relatedType: "Gerelateerd type",
      relatedBoatId: "Gerelateerd record",
      titleTemplate: "Taaktitel template",
      bodyTemplate: "Taaktekst template",
      internalCode: "Referentiecode",
    },
    hints: {
      after: "Maakt de taak aan na een vertraging vanaf de gekozen trigger.",
      recurring: "Maakt terugkerende herinneringen voor opvolgflows.",
      specificDate: "Handig voor vaste campagne- of compliance herinneringen.",
    },
    actions: {
      saveDraft: "Concept Opslaan",
      activate: "Regel Activeren",
      activateNow: "Activeer vanuit Preview",
    },
    empty: "Nog geen automatiseringsregels geconfigureerd.",
    active: "Actief",
    draft: "Concept",
  },
  de: {
    badge: "Task Operations",
    title: "Geplante Task-Automation",
    subtitle:
      "Konfigurieren Sie Erinnerungsregeln und automatische Tasks fur Kunden und Mitarbeiter.",
    backToTasks: "Zuruck zu Tasks",
    stats: {
      active: "Aktive Regeln",
      reminders: "Fallige Erinnerungen",
      templates: "Wiederverwendbare Vorlagen",
    },
    sections: {
      builder: "Automation Builder",
      examples: "Starter-Automationen",
      preview: "Regelvorschau",
      saved: "Konfigurierte Regeln",
    },
    labels: {
      ruleName: "Regelname",
      trigger: "Trigger-Quelle",
      scheduleMode: "Planungsregel",
      offsetValue: "Verzogerung",
      offsetUnit: "Verzogerungseinheit",
      recurringEvery: "Wiederholen alle",
      recurringUnit: "Wiederholungseinheit",
      specificDate: "Konkretes Datum",
      priority: "Prioritat",
      assigneeRule: "Zuweisen an",
      specificUser: "Spezifischer Benutzer",
      relatedType: "Zugehoriger Typ",
      relatedBoatId: "Zugehoriger Datensatz",
      titleTemplate: "Task-Titel Vorlage",
      bodyTemplate: "Task-Text Vorlage",
      internalCode: "Referenzcode",
    },
    hints: {
      after: "Erstellt die Task verzogert nach dem gewahlten Trigger.",
      recurring: "Erstellt wiederkehrende Erinnerungen fur Follow-up Ablaufe.",
      specificDate: "Nutzlich fur feste Kampagnen- oder Compliance-Erinnerungen.",
    },
    actions: {
      saveDraft: "Entwurf Speichern",
      activate: "Regel Aktivieren",
      activateNow: "Aus Vorschau Aktivieren",
    },
    empty: "Noch keine Automatisierungsregeln konfiguriert.",
    active: "Aktiv",
    draft: "Entwurf",
  },
} as const;

const triggerOptions: { value: TriggerType; label: string }[] = [
  { value: "boat_created", label: "Boat created" },
  { value: "boat_status_activated", label: "Boat activated" },
  { value: "booking_created", label: "Booking created" },
  { value: "booking_completed", label: "Booking completed" },
  { value: "bid_accepted", label: "Bid accepted" },
  { value: "deposit_paid", label: "Deposit paid" },
  { value: "user_registered", label: "User registered" },
  { value: "harbor_created", label: "Harbor created" },
  { value: "contract_signed", label: "Contract signed" },
  { value: "escrow_funded", label: "Escrow funded" },
  { value: "escrow_released", label: "Escrow released" },
  { value: "manual", label: "Manual test trigger" },
];

const scheduleOptions: { value: ScheduleMode; label: string }[] = [
  { value: "after", label: "+X after trigger" },
  { value: "recurring", label: "Recurring reminder" },
  { value: "specific_date", label: "Specific date" },
];

const assigneeOptions: { value: AssigneeRule; label: string }[] = [
  { value: "seller", label: "Seller" },
  { value: "harbor_user", label: "Harbor user" },
  { value: "creator", label: "Task creator" },
  { value: "specific_user", label: "Specific user" },
];

const priorityOptions: { value: PriorityLevel; label: string }[] = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
];

const relatedTypeOptions: { value: RelatedModelType; label: string }[] = [
  { value: "App\\Models\\Yacht", label: "Boat / Yacht" },
  { value: "App\\Models\\Booking", label: "Booking" },
  { value: "App\\Models\\Deal", label: "Deal" },
];

const starterRules: Pick<
  AutomationRule,
  | "name"
  | "trigger"
  | "scheduleMode"
  | "offsetValue"
  | "offsetUnit"
  | "recurringEvery"
  | "recurringUnit"
  | "specificDate"
  | "titleTemplate"
  | "bodyTemplate"
  | "priority"
  | "assigneeRule"
  | "specificUserId"
  | "relatedType"
  | "relatedBoatId"
  | "internalCode"
>[] = [
  {
    name: "Boat onboarding follow-up",
    trigger: "boat_created",
    scheduleMode: "after",
    offsetValue: "10",
    offsetUnit: "days",
    recurringEvery: "30",
    recurringUnit: "days",
    specificDate: "",
    titleTemplate: "Check listing photos for boat #{boat_id}",
    bodyTemplate:
      "Follow up with the seller if documents or media are still incomplete.",
    priority: "High",
    assigneeRule: "seller",
    specificUserId: "",
    relatedType: "App\\Models\\Yacht",
    relatedBoatId: "",
    internalCode: "AUTO-BOAT-10D",
  },
  {
    name: "Booking payment reminder",
    trigger: "booking_created",
    scheduleMode: "recurring",
    offsetValue: "2",
    offsetUnit: "days",
    recurringEvery: "7",
    recurringUnit: "days",
    specificDate: "",
    titleTemplate: "Send payment reminder for booking #{booking_id}",
    bodyTemplate:
      "If payment remains pending, remind the client and update the deal log.",
    priority: "High",
    assigneeRule: "harbor_user",
    specificUserId: "",
    relatedType: "App\\Models\\Booking",
    relatedBoatId: "",
    internalCode: "AUTO-BOOK-REM",
  },
  {
    name: "Accepted bid contract push",
    trigger: "bid_accepted",
    scheduleMode: "after",
    offsetValue: "4",
    offsetUnit: "hours",
    recurringEvery: "14",
    recurringUnit: "days",
    specificDate: "",
    titleTemplate: "Prepare contract package for deal #{deal_id}",
    bodyTemplate:
      "Notify the assigned employee and ensure Signhost documents are queued.",
    priority: "High",
    assigneeRule: "creator",
    specificUserId: "",
    relatedType: "App\\Models\\Deal",
    relatedBoatId: "",
    internalCode: "AUTO-BID-CLOSE",
  },
];

const initialRule = (): AutomationRule => ({
  id: "draft-form",
  name: "Client reminder workflow",
  trigger: "boat_created",
  scheduleMode: "after",
  offsetValue: "10",
  offsetUnit: "days",
  recurringEvery: "30",
  recurringUnit: "days",
  specificDate: "",
  titleTemplate: "Follow up with client about boat #{boat_id}",
  bodyTemplate:
    "Check documents, keep the client informed, and update the internal timeline.",
  priority: "High",
  assigneeRule: "harbor_user",
  specificUserId: "",
  relatedType: "App\\Models\\Yacht",
  relatedBoatId: "",
  internalCode: "AUTO-REM-001",
  status: "draft",
});

const normalizeTriggerType = (value: unknown): TriggerType => {
  const trigger = String(value || "");
  const matched = triggerOptions.find((option) => option.value === trigger);
  return matched?.value || "manual";
};

const normalizeRelatedModelType = (value: unknown): RelatedModelType => {
  const relatedType = String(value || "");

  if (relatedType === "App\\Models\\Booking") {
    return "App\\Models\\Booking";
  }

  if (relatedType === "App\\Models\\Deal") {
    return "App\\Models\\Deal";
  }

  return "App\\Models\\Yacht";
};

export default function TaskAutomationPage() {
  const locale = useLocale().split("-")[0] as keyof typeof copyByLocale;
  const copy = copyByLocale[locale] ?? copyByLocale.en;

  const [draft, setDraft] = useState<AutomationRule>(initialRule);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [automationCount, setAutomationCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [recentAssigneeIds, setRecentAssigneeIds] = useState<string[]>([]);
  const [recentRelatedRecords, setRecentRelatedRecords] = useState<
    Array<{ type: RelatedModelType; id: string }>
  >([]);

  const stats = useMemo(() => {
    const activeRules = rules.filter((rule) => rule.status === "active").length;
    const reminderCount = rules.reduce((count, rule) => {
      if (rule.scheduleMode === "recurring") {
        return count + 2;
      }

      if (rule.scheduleMode === "after") {
        return count + 1;
      }

      return count;
    }, 0);

    return {
      activeRules,
      reminders: automationCount || reminderCount,
      templates: rules.length,
    };
  }, [automationCount, rules]);

  const previewSchedule = useMemo(() => {
    if (draft.scheduleMode === "after") {
      return `Create task ${draft.offsetValue || "0"} ${draft.offsetUnit} after ${draft.trigger.replaceAll("_", " ")}`;
    }

    if (draft.scheduleMode === "recurring") {
      return `Create repeating reminder every ${draft.recurringEvery || "0"} ${draft.recurringUnit}`;
    }

    return draft.specificDate
      ? `Create task on ${draft.specificDate}`
      : "Pick a specific reminder date";
  }, [draft]);

  const setField = <K extends keyof AutomationRule>(
    key: K,
    value: AutomationRule[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const mapTemplateToRule = (template: any): AutomationRule => ({
    id: String(template?.id || `template-${Date.now()}`),
    name: String(template?.name || template?.title || "Automation rule"),
    trigger: normalizeTriggerType(template?.trigger_event),
    scheduleMode:
      template?.schedule_type === "specific_date"
        ? "specific_date"
        : template?.schedule_type === "recurring"
          ? "recurring"
          : "after",
    offsetValue: String(template?.delay_value || "0"),
    offsetUnit: (template?.delay_unit || "days") as AutomationRule["offsetUnit"],
    recurringEvery: String(template?.delay_value || "0"),
    recurringUnit: (template?.delay_unit || "days") as AutomationRule["recurringUnit"],
    specificDate: String(template?.due_at || template?.base_at || "").slice(0, 10),
    titleTemplate: String(template?.title || ""),
    bodyTemplate: String(template?.description || ""),
    priority: (template?.priority || "High") as PriorityLevel,
    assigneeRule:
      template?.default_assignee_type === "specific_user"
        ? "specific_user"
        : template?.default_assignee_type === "creator"
          ? "creator"
        : template?.default_assignee_type === "seller"
            ? "seller"
            : "harbor_user",
    specificUserId: String(template?.assigned_user_id || ""),
    relatedType: normalizeRelatedModelType(template?.related_type),
    relatedBoatId: String(template?.related_id || ""),
    internalCode: String(
      template?.internal_code || `AUTO-${String(template?.id || "").padStart(3, "0")}`,
    ),
    status: template?.is_active === false ? "draft" : "active",
  });

  useEffect(() => {
    const loadAutomationData = async () => {
      setLoadingRules(true);
      setErrorText(null);

      try {
        const [templatesRes, automationsRes] = await Promise.all([
          api.get("/task-automation-templates"),
          api.get("/task-automations"),
        ]);

        const templateData = Array.isArray(templatesRes.data)
          ? templatesRes.data
          : templatesRes.data?.data || [];
        const automationData = Array.isArray(automationsRes.data)
          ? automationsRes.data
          : automationsRes.data?.data || [];

        if (templateData.length > 0) {
          setRules(templateData.map(mapTemplateToRule));
        }
        setAutomationCount(automationData.length);
        setRecentAssigneeIds(
          Array.from(
            new Set(
              automationData
                .map((item: any) => String(item?.assigned_user_id || ""))
                .filter(Boolean),
            ),
          ),
        );
        const relatedRecordsMap = new Map<
          string,
          { type: RelatedModelType; id: string }
        >();

        automationData
          .filter((item: any) => item?.related_id)
          .forEach((item: any) => {
            const type = normalizeRelatedModelType(item?.related_type);
            const id = String(item.related_id);
            relatedRecordsMap.set(`${type}:${id}`, { type, id });
          });

        setRecentRelatedRecords(Array.from(relatedRecordsMap.values()));
      } catch (error: any) {
        setErrorText(
          error?.friendlyMessage ||
            error?.message ||
            "Failed to load task automation data.",
        );
      } finally {
        setLoadingRules(false);
      }
    };

    void loadAutomationData();
  }, []);

  const saveRule = async (status: RuleStatus) => {
    setSaving(true);
    setFeedback(null);
    setErrorText(null);

    try {
      const payload = {
        name: draft.name,
        trigger_event: draft.trigger,
        schedule_type:
          draft.scheduleMode === "specific_date"
            ? "specific_date"
            : draft.scheduleMode === "recurring"
              ? "recurring"
              : "relative",
        delay_value: Number(
          draft.scheduleMode === "recurring" ? draft.recurringEvery : draft.offsetValue,
        ) || 0,
        delay_unit:
          draft.scheduleMode === "recurring" ? draft.recurringUnit : draft.offsetUnit,
        title: draft.titleTemplate,
        description: draft.bodyTemplate,
        priority: draft.priority,
        default_assignee_type:
          draft.assigneeRule === "specific_user"
            ? "specific_user"
            : draft.assigneeRule === "harbor_user"
            ? "harbor"
              : draft.assigneeRule,
        notification_enabled: true,
        email_enabled: true,
        is_active: status === "active",
      };

      const { data } = await api.post("/task-automation-templates", payload);
      const createdRule = mapTemplateToRule({ ...data, ...payload });

      setRules((current) => [createdRule, ...current.filter((item) => item.id !== createdRule.id)]);
      setFeedback(status === "active" ? "Automation template activated." : "Automation template saved as draft.");

      if (status === "active" && draft.relatedBoatId) {
        try {
          await api.post("/task-automations", {
            template_id: data?.id,
            related_type: draft.relatedType,
            related_id: Number(draft.relatedBoatId),
            assigned_user_id: draft.specificUserId ? Number(draft.specificUserId) : null,
            base_at:
              draft.specificDate
                ? new Date(`${draft.specificDate}T09:00:00Z`).toISOString()
                : new Date().toISOString(),
          });
          setAutomationCount((current) => current + 1);
        } catch {
          // Keep template save successful even if no concrete scheduled instance was created.
        }
      }

      setDraft((current) => ({
        ...current,
        status: "draft",
        internalCode: `AUTO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      }));
    } catch (error: any) {
      setErrorText(
        error?.friendlyMessage ||
          error?.message ||
          "Failed to save automation template.",
      );
    } finally {
      setSaving(false);
    }
  };

  const applyStarterRule = (template: (typeof starterRules)[number]) => {
    setDraft((current) => ({
      ...current,
      ...template,
      status: current.status,
    }));
  };

  return (
    <div className="copied-admin-theme min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.badge}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                  {copy.title}
                </h1>
                <p className="text-sm leading-7 text-slate-600 md:text-base">
                  {copy.subtitle}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  icon={CheckCircle2}
                  label={copy.stats.active}
                  value={String(stats.activeRules)}
                />
                <StatCard
                  icon={BellRing}
                  label={copy.stats.reminders}
                  value={String(stats.reminders)}
                />
                <StatCard
                  icon={Layers3}
                  label={copy.stats.templates}
                  value={String(stats.templates)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/admin/tasks">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl border-slate-300 px-5"
                >
                  {copy.backToTasks}
                </Button>
              </Link>
              <Button
                type="button"
                className="rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800"
                onClick={() => void saveRule("active")}
                disabled={saving}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : copy.actions.activate}
              </Button>
            </div>
          </div>
        </section>

        {feedback && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        )}

        {errorText && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            {errorText}
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[1.35fr_0.95fr]">
          <section className="space-y-6 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-sky-600" />
              <h2 className="text-xl font-bold text-slate-900">
                {copy.sections.builder}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label={copy.labels.ruleName}>
                <input
                  className="input-base"
                  value={draft.name}
                  onChange={(event) => setField("name", event.target.value)}
                />
              </Field>

              <Field label={copy.labels.internalCode}>
                <input
                  className="input-base"
                  value={draft.internalCode}
                  onChange={(event) =>
                    setField("internalCode", event.target.value.toUpperCase())
                  }
                />
              </Field>

              <Field label={copy.labels.trigger}>
                <select
                  className="input-base"
                  value={draft.trigger}
                  onChange={(event) =>
                    setField("trigger", event.target.value as TriggerType)
                  }
                >
                  {triggerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={copy.labels.scheduleMode}>
                <select
                  className="input-base"
                  value={draft.scheduleMode}
                  onChange={(event) =>
                    setField("scheduleMode", event.target.value as ScheduleMode)
                  }
                >
                  {scheduleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {draft.scheduleMode === "after" && (
              <div className="grid gap-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 md:grid-cols-2">
                <Field label={copy.labels.offsetValue}>
                  <input
                    className="input-base"
                    type="number"
                    min="0"
                    value={draft.offsetValue}
                    onChange={(event) =>
                      setField("offsetValue", event.target.value)
                    }
                  />
                </Field>

                <Field label={copy.labels.offsetUnit}>
                  <select
                    className="input-base"
                    value={draft.offsetUnit}
                    onChange={(event) =>
                      setField(
                        "offsetUnit",
                        event.target.value as AutomationRule["offsetUnit"],
                      )
                    }
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </Field>

                <p className="md:col-span-2 text-sm text-slate-500">
                  {copy.hints.after}
                </p>
              </div>
            )}

            {draft.scheduleMode === "recurring" && (
              <div className="grid gap-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 md:grid-cols-2">
                <Field label={copy.labels.recurringEvery}>
                  <input
                    className="input-base"
                    type="number"
                    min="1"
                    value={draft.recurringEvery}
                    onChange={(event) =>
                      setField("recurringEvery", event.target.value)
                    }
                  />
                </Field>

                <Field label={copy.labels.recurringUnit}>
                  <select
                    className="input-base"
                    value={draft.recurringUnit}
                    onChange={(event) =>
                      setField(
                        "recurringUnit",
                        event.target.value as AutomationRule["recurringUnit"],
                      )
                    }
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </Field>

                <p className="md:col-span-2 text-sm text-slate-500">
                  {copy.hints.recurring}
                </p>
              </div>
            )}

            {draft.scheduleMode === "specific_date" && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <Field label={copy.labels.specificDate}>
                  <input
                    className="input-base"
                    type="date"
                    value={draft.specificDate}
                    onChange={(event) =>
                      setField("specificDate", event.target.value)
                    }
                  />
                </Field>
                <p className="mt-4 text-sm text-slate-500">
                  {copy.hints.specificDate}
                </p>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Field label={copy.labels.priority}>
                <select
                  className="input-base"
                  value={draft.priority}
                  onChange={(event) =>
                    setField("priority", event.target.value as PriorityLevel)
                  }
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={copy.labels.assigneeRule}>
                <select
                  className="input-base"
                  value={draft.assigneeRule}
                  onChange={(event) =>
                    setField("assigneeRule", event.target.value as AssigneeRule)
                  }
                >
                  {assigneeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              {draft.assigneeRule === "specific_user" ? (
                <Field label={copy.labels.specificUser}>
                  <div className="space-y-3">
                    <select
                      className="input-base"
                      value={
                        recentAssigneeIds.includes(draft.specificUserId)
                          ? draft.specificUserId
                          : ""
                      }
                      onChange={(event) =>
                        setField("specificUserId", event.target.value)
                      }
                    >
                      <option value="">Select a recent assignee</option>
                      {recentAssigneeIds.map((userId) => (
                        <option key={userId} value={userId}>
                          User #{userId}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-base"
                      placeholder="Or enter a custom user ID"
                      value={draft.specificUserId}
                      onChange={(event) =>
                        setField("specificUserId", event.target.value)
                      }
                    />
                  </div>
                </Field>
              ) : (
                <Field label={copy.labels.relatedBoatId}>
                  <div className="space-y-3">
                    <select
                      className="input-base"
                      value={draft.relatedType}
                      onChange={(event) =>
                        setField(
                          "relatedType",
                          event.target.value as RelatedModelType,
                        )
                      }
                    >
                      {relatedTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input-base"
                      value={
                        recentRelatedRecords.some(
                          (item) =>
                            item.type === draft.relatedType &&
                            item.id === draft.relatedBoatId,
                        )
                          ? `${draft.relatedType}:${draft.relatedBoatId}`
                          : ""
                      }
                      onChange={(event) => {
                        const [type, id] = event.target.value.split(":");
                        if (!type || !id) return;
                        setField("relatedType", type as RelatedModelType);
                        setField("relatedBoatId", id);
                      }}
                    >
                      <option value="">Select a recent related record</option>
                      {recentRelatedRecords
                        .filter((item) => item.type === draft.relatedType)
                        .map((item) => (
                          <option
                            key={`${item.type}:${item.id}`}
                            value={`${item.type}:${item.id}`}
                          >
                            {item.type.split("\\").pop()} #{item.id}
                          </option>
                        ))}
                    </select>
                    <input
                      className="input-base"
                      placeholder="Or enter a custom related ID"
                      value={draft.relatedBoatId}
                      onChange={(event) =>
                        setField("relatedBoatId", event.target.value)
                      }
                    />
                  </div>
                </Field>
              )}
            </div>

            <div className="grid gap-5">
              <Field label={copy.labels.titleTemplate}>
                <input
                  className="input-base"
                  value={draft.titleTemplate}
                  onChange={(event) =>
                    setField("titleTemplate", event.target.value)
                  }
                />
              </Field>

              <Field label={copy.labels.bodyTemplate}>
                <textarea
                  className="input-base min-h-32 resize-y"
                  value={draft.bodyTemplate}
                  onChange={(event) =>
                    setField("bodyTemplate", event.target.value)
                  }
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-slate-300 px-5"
                onClick={() => void saveRule("draft")}
                disabled={saving}
              >
                <Plus className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : copy.actions.saveDraft}
              </Button>
              <Button
                type="button"
                className="rounded-2xl bg-sky-600 px-5 text-white hover:bg-sky-500"
                onClick={() => void saveRule("active")}
                disabled={saving}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : copy.actions.activate}
              </Button>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">
                  {copy.sections.preview}
                </h2>
              </div>

              <div className="mt-5 space-y-4 rounded-3xl bg-slate-900 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                      {draft.internalCode}
                    </p>
                    <h3 className="mt-2 text-xl font-bold">{draft.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                    {copy.draft}
                  </span>
                </div>

                <PreviewRow icon={Workflow} label="Trigger" value={draft.trigger} />
                <PreviewRow
                  icon={Clock3}
                  label="Schedule"
                  value={previewSchedule}
                />
                <PreviewRow
                  icon={UserRound}
                  label="Assignee"
                  value={draft.assigneeRule}
                />
                <PreviewRow
                  icon={Bot}
                  label="Task title"
                  value={draft.titleTemplate}
                />

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-200">
                  {draft.bodyTemplate}
                </div>

                <Button
                  type="button"
                  className="w-full rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
                  onClick={() => void saveRule("active")}
                  disabled={saving}
                >
                  {saving ? "Saving..." : copy.actions.activateNow}
                </Button>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-bold text-slate-900">
                  {copy.sections.examples}
                </h2>
              </div>

              <div className="mt-5 space-y-3">
                {starterRules.map((rule) => (
                  <button
                    key={rule.internalCode}
                    type="button"
                    className="w-full rounded-3xl border border-slate-200 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
                    onClick={() => applyStarterRule(rule)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {rule.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {rule.titleTemplate}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex items-center gap-3">
                <Layers3 className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">
                  {copy.sections.saved}
                </h2>
              </div>

              <div className="mt-5 space-y-3">
                {loadingRules ? (
                  <p className="rounded-3xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Loading automation templates...
                  </p>
                ) : rules.length === 0 ? (
                  <p className="rounded-3xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    {copy.empty}
                  </p>
                ) : (
                  rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-3xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {rule.name}
                          </p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {rule.internalCode}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                            rule.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {rule.status === "active" ? copy.active : copy.draft}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        {rule.titleTemplate}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>
        </div>
      </div>

      <style jsx global>{`
        .input-base {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.85rem 1rem;
          font-size: 0.95rem;
          color: rgb(15 23 42);
          outline: none;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .input-base:focus {
          border-color: rgb(14 165 233);
          box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.12);
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Workflow;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <Icon className="mt-0.5 h-4 w-4 text-sky-200" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
          {label}
        </p>
        <p className="mt-1 text-sm text-white">{value}</p>
      </div>
    </div>
  );
}
