"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
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
  FlaskConical,
  Layers3,
  PlayCircle,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
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
  | "offer_accepted"
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

interface AutomationRuleItem {
  title: string;
  description: string;
  priority: PriorityLevel;
  position: number;
}

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
  boatTypeFilter: string[];
  items: AutomationRuleItem[];
}

interface AutomationTemplateOption {
  id: number;
  name: string;
  title: string;
  priority: PriorityLevel;
}

interface EngineRule {
  id: number;
  name: string;
  internal_code: string | null;
  trigger_event: TriggerType;
  is_active: boolean;
  target_role: "client" | "employee" | "admin";
  target_user_type: "buyer" | "seller" | null;
  assignee_rule: AssigneeRule;
  assigned_user_id: number | null;
  boat_types: string[];
  boat_year_from: number | null;
  boat_year_to: number | null;
  location_filter: string | null;
  visibility_delay_hours: number;
  visibility_status: string | null;
  visibility_status_source: string | null;
  actionable_delay_hours: number | null;
  actionable_status: string | null;
  actionable_status_source: string | null;
  actionable_requires_internal_tasks_completed: boolean;
  templates: AutomationTemplateOption[];
}

interface EngineRuleForm {
  id: number | null;
  name: string;
  internalCode: string;
  triggerEvent: TriggerType;
  isActive: boolean;
  targetRole: "client" | "employee" | "admin";
  targetUserType: "buyer" | "seller";
  assigneeRule: AssigneeRule;
  assignedUserId: string;
  boatTypes: string;
  boatYearFrom: string;
  boatYearTo: string;
  locationFilter: string;
  visibilityDelayHours: string;
  visibilityStatus: string;
  visibilityStatusSource: "related" | "boat" | "deal" | "bid" | "booking";
  actionableDelayHours: string;
  actionableStatus: string;
  actionableStatusSource: "related" | "boat" | "deal" | "bid" | "booking";
  actionableRequiresInternalTasksCompleted: boolean;
  templateIds: string[];
}

interface RawTemplate {
  id?: number | string;
  name?: string;
  trigger_event?: string;
  schedule_type?: string;
  delay_value?: number | string;
  delay_unit?: string;
  due_at?: string;
  base_at?: string;
  title?: string;
  description?: string;
  priority?: string;
  default_assignee_type?: string;
  assigned_user_id?: number | string | null;
  related_type?: string | null;
  related_id?: number | string | null;
  internal_code?: string | null;
  is_active?: boolean;
  boat_type_filter?: string[];
  items?: RawTemplateItem[];
}

interface RawTemplateItem {
  title?: string;
  description?: string;
  priority?: string;
  position?: number | string;
}

interface RawAutomation {
  assigned_user_id?: number | string | null;
  related_type?: string | null;
  related_id?: number | string | null;
}

interface RawEngineRule extends Omit<Partial<EngineRule>, "templates"> {
  templates?: RawTemplate[];
}

interface SimulateTask {
  title: string;
  would_skip_duplicate?: boolean;
}

interface SimulatePreview {
  rule_id: number;
  rule_name: string;
  tasks: SimulateTask[];
}

interface SimulateResponse {
  error?: string;
  matched_rules?: number;
  preview?: SimulatePreview[];
}

interface ExecutionLog {
  id: number;
  rule_id?: number | null;
  rule?: { id: number; name: string } | null;
  trigger_event: string;
  result: string;
  reason?: string | null;
  created_task_ids?: number[];
  created_at?: string;
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
      boatTypes: "Boat types (Filter)",
      taskItems: "Task items (Multi-task template)",
      addItem: "Add task item",
      itemTitle: "Task title",
      itemDescription: "Task description",
      itemPriority: "Priority",
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
      boatTypes: "Boot types (Filter)",
      taskItems: "Taak items (Multi-taak template)",
      addItem: "Voeg taak item toe",
      itemTitle: "Taak titel",
      itemDescription: "Taak omschrijving",
      itemPriority: "Prioriteit",
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
      boatTypes: "Bootstypen (Filter)",
      taskItems: "Aufgabenelemente (Multi-Task-Vorlage)",
      addItem: "Aufgabenelement hinzufügen",
      itemTitle: "Aufgabentitel",
      itemDescription: "Aufgabenbeschreibung",
      itemPriority: "Priorität",
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
  { value: "offer_accepted", label: "Offer accepted" },
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

const knownStatusOptions = [
  { value: "Draft", label: "Draft" },
  { value: "For Sale", label: "For Sale" },
  { value: "For Bid", label: "For Bid" },
  { value: "Sold", label: "Sold" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Maintenance", label: "Maintenance" },
  { value: "Pending", label: "Pending" },
  { value: "Completed", label: "Completed" },
  { value: "Won", label: "Won" },
  { value: "Leading", label: "Leading" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Published", label: "Published" },
  { value: "Failed", label: "Failed" },
  { value: "Closed", label: "Closed" },
] as const;

const relatedTypeOptions: { value: RelatedModelType; label: string }[] = [
  { value: "App\\Models\\Yacht", label: "Boat / Yacht" },
  { value: "App\\Models\\Booking", label: "Booking" },
  { value: "App\\Models\\Deal", label: "Deal" },
];

const boatTypeOptions = [
  "Sailship",
  "Speedboat",
  "Motorboat",
  "Catamaran",
  "Rib",
  "Trawler",
  "Sloop",
] as const;

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
  | "boatTypeFilter"
  | "items"
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
    boatTypeFilter: [],
    items: [],
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
    boatTypeFilter: [],
    items: [],
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
    boatTypeFilter: [],
    items: [],
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
  boatTypeFilter: [],
  items: [],
});

const initialEngineRuleForm = (): EngineRuleForm => ({
  id: null,
  name: "",
  internalCode: "",
  triggerEvent: "boat_created",
  isActive: true,
  targetRole: "client",
  targetUserType: "seller",
  assigneeRule: "seller",
  assignedUserId: "",
  boatTypes: "",
  boatYearFrom: "",
  boatYearTo: "",
  locationFilter: "",
  visibilityDelayHours: "0",
  visibilityStatus: "",
  visibilityStatusSource: "related",
  actionableDelayHours: "",
  actionableStatus: "",
  actionableStatusSource: "related",
  actionableRequiresInternalTasksCompleted: false,
  templateIds: [],
});

const triggerEntityMap: Record<string, { type: string; label: string }> = {
  boat_created: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  boat_status_activated: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  booking_created: { type: "App\\Models\\Booking", label: "Booking ID" },
  booking_completed: { type: "App\\Models\\Booking", label: "Booking ID" },
  bid_accepted: { type: "App\\Models\\Bid", label: "Bid ID" },
  offer_accepted: { type: "App\\Models\\Bid", label: "Bid ID" },
  deposit_paid: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  user_registered: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  harbor_created: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  contract_signed: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  escrow_funded: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  escrow_released: { type: "App\\Models\\Yacht", label: "Yacht ID" },
  manual: { type: "App\\Models\\Yacht", label: "Yacht ID" },
};

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

type ApiValidationErrors = Record<string, string | string[]>;

type ApiErrorLike = {
  friendlyMessage?: unknown;
  message?: unknown;
  response?: {
    status?: number;
    data?: {
      message?: unknown;
      error?: unknown;
      errors?: unknown;
    };
  };
};

const validationMessages = (errors: unknown) => {
  if (!errors || typeof errors !== "object") return [];

  return Object.values(errors as ApiValidationErrors)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value).trim())
    .filter(Boolean);
};

const isRawAxiosMessage = (message: string) =>
  /^Request failed with status code \d+$/i.test(message.trim());

const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const value = error as ApiErrorLike;
    const friendlyMessage = String(value.friendlyMessage || "").trim();
    if (friendlyMessage) return friendlyMessage;

    const status = value.response?.status;
    const payload = value.response?.data;
    const messages = validationMessages(payload?.errors);

    if (status === 422) {
      if (messages.length > 0) {
        const visibleMessages = messages.slice(0, 3).join(" ");
        const hiddenCount = messages.length - 3;
        return hiddenCount > 0
          ? `Please fix the form: ${visibleMessages} (${hiddenCount} more.)`
          : `Please fix the form: ${visibleMessages}`;
      }

      const payloadMessage = String(payload?.message || payload?.error || "").trim();
      if (payloadMessage && payloadMessage !== "The given data was invalid.") {
        return payloadMessage;
      }

      return "Please check the required fields and try again.";
    }

    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403) return "You do not have permission to perform this action.";
    if (status === 404) return "The selected record could not be found.";
    if (status && status >= 500) return "The server could not complete this action. Please try again.";

    const payloadMessage = String(payload?.message || payload?.error || "").trim();
    if (payloadMessage) return payloadMessage;

    const message = String(value.message || "").trim();
    if (message && !isRawAxiosMessage(message)) return message;

    if (!value.response && message) {
      return "Could not reach the backend. Check that the backend server is running.";
    }
  }

  return fallback;
};

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
  const params = useParams<{ role?: string }>();
  const role = params?.role ?? "admin";
  const copy = copyByLocale[locale] ?? copyByLocale.en;

  const [draft, setDraft] = useState<AutomationRule>(initialRule);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templateOptions, setTemplateOptions] = useState<AutomationTemplateOption[]>([]);
  const [engineRules, setEngineRules] = useState<EngineRule[]>([]);
  const [engineRuleForm, setEngineRuleForm] = useState<EngineRuleForm>(initialEngineRuleForm);
  const [automationCount, setAutomationCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingEngineRule, setSavingEngineRule] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [simulatingRuleId, setSimulatingRuleId] = useState<number | null>(null);
  const [simulateEntityId, setSimulateEntityId] = useState<Record<number, string>>({});
  const [simulateResult, setSimulateResult] = useState<Record<number, SimulateResponse>>({});
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
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

  const addItem = () => {
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          title: "",
          description: "",
          priority: "Medium",
          position: current.items.length,
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (
    index: number,
    field: keyof AutomationRuleItem,
    value: string | number,
  ) => {
    setDraft((current) => {
      const newItems = [...current.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...current, items: newItems };
    });
  };

  const mapTemplateToRule = useCallback((template: RawTemplate): AutomationRule => ({
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
            : template?.default_assignee_type === "admin" || template?.default_assignee_type === "employee"
              ? "harbor_user"
              : "harbor_user",
    specificUserId: String(template?.assigned_user_id || ""),
    relatedType: normalizeRelatedModelType(template?.related_type),
    relatedBoatId: String(template?.related_id || ""),
    internalCode: String(
      template?.internal_code || `AUTO-${String(template?.id || "").padStart(3, "0")}`,
    ),
    status: template?.is_active === false ? "draft" : "active",
    boatTypeFilter: Array.isArray(template?.boat_type_filter) ? template.boat_type_filter : [],
    items: Array.isArray(template?.items)
      ? template.items.map((item) => ({
          title: String(item.title || ""),
          description: String(item.description || ""),
          priority: (item.priority || "Medium") as PriorityLevel,
          position: Number(item.position || 0),
        }))
      : [],
  }), []);

  const mapTemplateOption = useCallback((template: RawTemplate): AutomationTemplateOption => ({
    id: Number(template.id),
    name: String(template.name || template.title || `Template #${template.id}`),
    title: String(template.title || ""),
    priority: (template.priority || "Medium") as PriorityLevel,
  }), []);

  const mapEngineRule = useCallback((rule: RawEngineRule): EngineRule => ({
    id: Number(rule.id),
    name: String(rule.name || `Rule #${rule.id}`),
    internal_code: rule.internal_code ? String(rule.internal_code) : null,
    trigger_event: normalizeTriggerType(rule.trigger_event),
    is_active: Boolean(rule.is_active),
    target_role: (rule.target_role || "employee") as EngineRule["target_role"],
    target_user_type: rule.target_user_type ? String(rule.target_user_type) as EngineRule["target_user_type"] : null,
    assignee_rule: (rule.assignee_rule || "harbor_user") as AssigneeRule,
    assigned_user_id: rule.assigned_user_id ? Number(rule.assigned_user_id) : null,
    boat_types: Array.isArray(rule.boat_types) ? rule.boat_types.map(String) : [],
    boat_year_from: rule.boat_year_from !== null && rule.boat_year_from !== undefined ? Number(rule.boat_year_from) : null,
    boat_year_to: rule.boat_year_to !== null && rule.boat_year_to !== undefined ? Number(rule.boat_year_to) : null,
    location_filter: rule.location_filter ? String(rule.location_filter) : null,
    visibility_delay_hours: Number(rule.visibility_delay_hours || 0),
    visibility_status: rule.visibility_status ? String(rule.visibility_status) : null,
    visibility_status_source: rule.visibility_status_source ? String(rule.visibility_status_source) : null,
    actionable_delay_hours: rule.actionable_delay_hours !== null && rule.actionable_delay_hours !== undefined
      ? Number(rule.actionable_delay_hours)
      : null,
    actionable_status: rule.actionable_status ? String(rule.actionable_status) : null,
    actionable_status_source: rule.actionable_status_source ? String(rule.actionable_status_source) : null,
    actionable_requires_internal_tasks_completed: Boolean(rule.actionable_requires_internal_tasks_completed),
    templates: Array.isArray(rule.templates) ? rule.templates.map(mapTemplateOption) : [],
  }), [mapTemplateOption]);

  useEffect(() => {
    const loadAutomationData = async () => {
      setLoadingRules(true);
      setErrorText(null);

      try {
        const [templatesRes, automationsRes, rulesRes] = await Promise.all([
          api.get("/task-automation-templates"),
          api.get("/task-automations"),
          api.get("/task-automation-rules"),
        ]);

        const templateData: RawTemplate[] = Array.isArray(templatesRes.data)
          ? templatesRes.data
          : templatesRes.data?.data || [];
        const automationData: RawAutomation[] = Array.isArray(automationsRes.data)
          ? automationsRes.data
          : automationsRes.data?.data || [];
        const ruleData: RawEngineRule[] = Array.isArray(rulesRes.data)
          ? rulesRes.data
          : rulesRes.data?.data || [];

        if (templateData.length > 0) {
          setRules(templateData.map(mapTemplateToRule));
        }
        setTemplateOptions(templateData.map(mapTemplateOption));
        setEngineRules(ruleData.map(mapEngineRule));
        setAutomationCount(automationData.length);
        setRecentAssigneeIds(
          Array.from(
            new Set(
              automationData
                .map((item) => String(item?.assigned_user_id || ""))
                .filter(Boolean),
            ),
          ),
        );
        const relatedRecordsMap = new Map<
          string,
          { type: RelatedModelType; id: string }
        >();

        automationData
          .filter((item) => item?.related_id)
          .forEach((item) => {
            const type = normalizeRelatedModelType(item?.related_type);
            const id = String(item.related_id);
            relatedRecordsMap.set(`${type}:${id}`, { type, id });
          });

        setRecentRelatedRecords(Array.from(relatedRecordsMap.values()));
      } catch (error: unknown) {
        setErrorText(errorMessage(error, "Failed to load task automation data."));
      } finally {
        setLoadingRules(false);
      }
    };

    void loadAutomationData();
  }, [mapEngineRule, mapTemplateOption, mapTemplateToRule]);

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
              ? "admin"
              : draft.assigneeRule,
        notification_enabled: true,
        email_enabled: true,
        is_active: status === "active",
        boat_type_filter: draft.trigger === "boat_created" ? draft.boatTypeFilter : [],
        items: draft.items.map((item, index) => ({
          ...item,
          position: index,
        })),
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
    } catch (error: unknown) {
      setErrorText(errorMessage(error, "Failed to save automation template."));
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

  const setEngineField = <K extends keyof EngineRuleForm>(
    key: K,
    value: EngineRuleForm[K],
  ) => {
    setEngineRuleForm((current) => ({ ...current, [key]: value }));
  };

  const resetEngineRuleForm = () => setEngineRuleForm(initialEngineRuleForm());

  const reloadEngineRules = async () => {
    const { data } = await api.get("/task-automation-rules");
    const ruleData: RawEngineRule[] = Array.isArray(data) ? data : data?.data || [];
    setEngineRules(ruleData.map(mapEngineRule));
  };

  const saveEngineRule = async () => {
    setSavingEngineRule(true);
    setFeedback(null);
    setErrorText(null);

    const payload = {
      name: engineRuleForm.name,
      internal_code: engineRuleForm.internalCode || null,
      trigger_event: engineRuleForm.triggerEvent,
      is_active: engineRuleForm.isActive,
      target_role: engineRuleForm.targetRole,
      target_user_type: engineRuleForm.targetRole === "client" ? engineRuleForm.targetUserType : null,
      assignee_rule: engineRuleForm.assigneeRule,
      assigned_user_id: engineRuleForm.assignedUserId ? Number(engineRuleForm.assignedUserId) : null,
      boat_types: splitCsv(engineRuleForm.boatTypes),
      boat_year_from: engineRuleForm.boatYearFrom ? Number(engineRuleForm.boatYearFrom) : null,
      boat_year_to: engineRuleForm.boatYearTo ? Number(engineRuleForm.boatYearTo) : null,
      location_filter: engineRuleForm.locationFilter || null,
      visibility_delay_hours: Number(engineRuleForm.visibilityDelayHours || 0),
      visibility_status: engineRuleForm.visibilityStatus || null,
      visibility_status_source: engineRuleForm.visibilityStatus ? engineRuleForm.visibilityStatusSource : null,
      actionable_delay_hours: engineRuleForm.actionableDelayHours ? Number(engineRuleForm.actionableDelayHours) : null,
      actionable_status: engineRuleForm.actionableStatus || null,
      actionable_status_source: engineRuleForm.actionableStatus ? engineRuleForm.actionableStatusSource : null,
      actionable_requires_internal_tasks_completed: engineRuleForm.actionableRequiresInternalTasksCompleted,
      template_ids: engineRuleForm.templateIds.map((id) => Number(id)),
    };

    try {
      if (engineRuleForm.id) {
        await api.put(`/task-automation-rules/${engineRuleForm.id}`, payload);
        setFeedback("Automation rule updated.");
      } else {
        await api.post("/task-automation-rules", payload);
        setFeedback("Automation rule created.");
      }

      await reloadEngineRules();
      resetEngineRuleForm();
    } catch (error: unknown) {
      setErrorText(errorMessage(error, "Failed to save automation rule."));
    } finally {
      setSavingEngineRule(false);
    }
  };

  const editEngineRule = (rule: EngineRule) => {
    setEngineRuleForm({
      id: rule.id,
      name: rule.name,
      internalCode: rule.internal_code || "",
      triggerEvent: rule.trigger_event,
      isActive: rule.is_active,
      targetRole: rule.target_role,
      targetUserType: rule.target_user_type || "seller",
      assigneeRule: rule.assignee_rule,
      assignedUserId: rule.assigned_user_id ? String(rule.assigned_user_id) : "",
      boatTypes: rule.boat_types.join(", "),
      boatYearFrom: rule.boat_year_from !== null ? String(rule.boat_year_from) : "",
      boatYearTo: rule.boat_year_to !== null ? String(rule.boat_year_to) : "",
      locationFilter: rule.location_filter || "",
      visibilityDelayHours: String(rule.visibility_delay_hours || 0),
      visibilityStatus: rule.visibility_status || "",
      visibilityStatusSource: (rule.visibility_status_source || "related") as EngineRuleForm["visibilityStatusSource"],
      actionableDelayHours: rule.actionable_delay_hours !== null ? String(rule.actionable_delay_hours) : "",
      actionableStatus: rule.actionable_status || "",
      actionableStatusSource: (rule.actionable_status_source || "related") as EngineRuleForm["actionableStatusSource"],
      actionableRequiresInternalTasksCompleted: rule.actionable_requires_internal_tasks_completed,
      templateIds: rule.templates.map((template) => String(template.id)),
    });
  };

  const deleteEngineRule = async (ruleId: number) => {
    setFeedback(null);
    setErrorText(null);

    try {
      await api.delete(`/task-automation-rules/${ruleId}`);
      setFeedback("Automation rule deleted.");
      await reloadEngineRules();
    } catch (error: unknown) {
      setErrorText(errorMessage(error, "Failed to delete automation rule."));
    }
  };

  const simulateEngineRule = async (rule: EngineRule) => {
    const entityId = simulateEntityId[rule.id];
    if (!entityId) return;

    setSimulatingRuleId(rule.id);
    try {
      const { data } = await api.post("/task-automation-rules/simulate", {
        trigger_event: rule.trigger_event,
        entity_type: triggerEntityMap[rule.trigger_event]?.type ?? "App\\Models\\Yacht",
        entity_id: Number(entityId),
      });
      setSimulateResult((current) => ({ ...current, [rule.id]: data }));
    } catch (error: unknown) {
      setSimulateResult((current) => ({
        ...current,
        [rule.id]: { error: errorMessage(error, "Simulation failed.") },
      }));
    } finally {
      setSimulatingRuleId(null);
    }
  };

  const loadExecutionLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data } = await api.get("/task-automation-rules/logs");
      setExecutionLogs(Array.isArray(data) ? data : data?.data || []);
    } catch (error: unknown) {
      setErrorText(errorMessage(error, "Failed to load automation logs."));
    } finally {
      setLoadingLogs(false);
    }
  };

  const toggleLogs = () => {
    if (!logsOpen) {
      void loadExecutionLogs();
    }
    setLogsOpen((open) => !open);
  };

  const retryExecutionLog = async (logId: number) => {
    setFeedback(null);
    setErrorText(null);

    try {
      await api.post(`/task-automation-rules/logs/${logId}/retry`);
      setFeedback("Automation retry completed.");
      await loadExecutionLogs();
    } catch (error: unknown) {
      setErrorText(errorMessage(error, "Failed to retry automation run."));
    }
  };

  return (
    <div className="copied-admin-theme min-h-screen px-4 py-8 text-slate-900 md:px-8 dark:text-slate-100">
      <datalist id="automation-visible-status-options">
        {knownStatusOptions.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
      <datalist id="automation-actionable-status-options">
        {knownStatusOptions.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
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
              <Link href={`/dashboard/${role}/tasks`}>
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
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
            {feedback}
          </div>
        )}

        {errorText && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
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

              {draft.trigger === "boat_created" && (
                <div className="md:col-span-2">
                  <Field label={copy.labels.boatTypes}>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {boatTypeOptions.map((type) => {
                        const isSelected = draft.boatTypeFilter.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? draft.boatTypeFilter.filter((t) => t !== type)
                                : [...draft.boatTypeFilter, type];
                              setField("boatTypeFilter", next);
                            }}
                            className={`rounded-xl border px-3 py-1 text-sm font-medium transition-colors ${
                              isSelected
                                ? "border-sky-600 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-950/20 dark:text-sky-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                            }`}
                          >
                            {isSelected && (
                              <CheckCircle2 className="mr-1 inline h-3 w-3" />
                            )}
                            {type}
                          </button>
                        );
                      })}
                      {draft.boatTypeFilter.length === 0 && (
                        <p className="mt-1 w-full text-xs text-slate-500 italic">
                          No filter: applies to all boat types.
                        </p>
                      )}
                    </div>
                  </Field>
                </div>
              )}
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

              <div className="mt-4 space-y-4 rounded-3xl border border-slate-200 bg-slate-50/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-5 w-5 text-sky-600" />
                    <h3 className="font-bold text-slate-900">
                      {copy.labels.taskItems}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-xl bg-white text-sky-600 shadow-sm transition-all hover:bg-sky-50"
                    onClick={addItem}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {copy.labels.addItem}
                  </Button>
                </div>

                {draft.items.length === 0 ? (
                  <p className="text-center text-sm italic text-slate-500 py-4">
                    Direct task creation (single task)
                  </p>
                ) : (
                  <div className="space-y-4">
                    {draft.items.map((item, index) => (
                      <div
                        key={index}
                        className="relative space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="absolute right-3 top-3 text-slate-400 transition-colors hover:text-rose-500"
                        >
                          <Plus className="h-4 w-4 rotate-45" />
                        </button>

                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <input
                            className="input-base border-transparent bg-slate-50 p-2 text-sm font-semibold focus:bg-white"
                            placeholder={copy.labels.itemTitle}
                            value={item.title}
                            onChange={(e) =>
                              updateItem(index, "title", e.target.value)
                            }
                          />
                          <select
                            className="input-base w-32 border-transparent bg-slate-50 p-2 text-xs focus:bg-white"
                            value={item.priority}
                            onChange={(e) =>
                              updateItem(
                                index,
                                "priority",
                                e.target.value as PriorityLevel,
                              )
                            }
                          >
                            {priorityOptions.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          className="input-base border-transparent bg-slate-50 p-2 text-xs focus:bg-white"
                          placeholder={copy.labels.itemDescription}
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, "description", e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

        <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-sky-600" />
                <h2 className="text-xl font-bold text-slate-900">Automation Rules</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Separate rule engine controls when templates run, who receives tasks, and which records qualify.
              </p>
            </div>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={resetEngineRuleForm}>
              New rule
            </Button>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Rule name">
              <input
                className="input-base"
                value={engineRuleForm.name}
                onChange={(event) => setEngineField("name", event.target.value)}
              />
            </Field>

            <Field label="Internal code">
              <input
                className="input-base"
                value={engineRuleForm.internalCode}
                onChange={(event) => setEngineField("internalCode", event.target.value.toUpperCase())}
              />
            </Field>

            <Field label="Trigger event">
              <select
                className="input-base"
                value={engineRuleForm.triggerEvent}
                onChange={(event) => setEngineField("triggerEvent", event.target.value as TriggerType)}
              >
                {triggerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Target role">
              <select
                className="input-base"
                value={engineRuleForm.targetRole}
                onChange={(event) => setEngineField("targetRole", event.target.value as EngineRuleForm["targetRole"])}
              >
                <option value="client">Client</option>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </Field>

            {engineRuleForm.targetRole === "client" ? (
              <Field label="Target user type">
                <select
                  className="input-base"
                  value={engineRuleForm.targetUserType}
                  onChange={(event) => setEngineField("targetUserType", event.target.value as EngineRuleForm["targetUserType"])}
                >
                  <option value="seller">Seller</option>
                  <option value="buyer">Buyer</option>
                </select>
              </Field>
            ) : (
              <Field label="Assign to">
                <select
                  className="input-base"
                  value={engineRuleForm.assigneeRule}
                  onChange={(event) => setEngineField("assigneeRule", event.target.value as AssigneeRule)}
                >
                  {assigneeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Specific user ID">
              <input
                className="input-base"
                value={engineRuleForm.assignedUserId}
                onChange={(event) => setEngineField("assignedUserId", event.target.value)}
                placeholder="Only for specific user"
              />
            </Field>

            <Field label="Boat types">
              <input
                className="input-base"
                value={engineRuleForm.boatTypes}
                onChange={(event) => setEngineField("boatTypes", event.target.value)}
                placeholder="Motorboat, Sailship"
              />
            </Field>

            <Field label="Boat year from">
              <input
                className="input-base"
                type="number"
                value={engineRuleForm.boatYearFrom}
                onChange={(event) => setEngineField("boatYearFrom", event.target.value)}
              />
            </Field>

            <Field label="Boat year to">
              <input
                className="input-base"
                type="number"
                value={engineRuleForm.boatYearTo}
                onChange={(event) => setEngineField("boatYearTo", event.target.value)}
              />
            </Field>

            <Field label="Location filter">
              <input
                className="input-base"
                value={engineRuleForm.locationFilter}
                onChange={(event) => setEngineField("locationFilter", event.target.value)}
                placeholder="Amsterdam"
              />
            </Field>

            <Field label="Visible after hours">
              <input
                className="input-base"
                type="number"
                min="0"
                value={engineRuleForm.visibilityDelayHours}
                onChange={(event) => setEngineField("visibilityDelayHours", event.target.value)}
              />
            </Field>

            <Field label="Visible when status is">
              <input
                className="input-base"
                list="automation-visible-status-options"
                value={engineRuleForm.visibilityStatus}
                onChange={(event) => setEngineField("visibilityStatus", event.target.value)}
                placeholder="Select Status"
              />
            </Field>

            <Field label="Status source">
              <select
                className="input-base"
                value={engineRuleForm.visibilityStatusSource}
                onChange={(event) => setEngineField("visibilityStatusSource", event.target.value as EngineRuleForm["visibilityStatusSource"])}
              >
                <option value="related">Related</option>
                <option value="boat">Boat</option>
                <option value="booking">Booking</option>
                <option value="bid">Bid</option>
                <option value="deal">Deal</option>
              </select>
            </Field>

            <Field label="Actionable after hours">
              <input
                className="input-base"
                type="number"
                min="0"
                value={engineRuleForm.actionableDelayHours}
                onChange={(event) => setEngineField("actionableDelayHours", event.target.value)}
              />
            </Field>

            <Field label="Actionable when status is">
              <input
                className="input-base"
                list="automation-actionable-status-options"
                value={engineRuleForm.actionableStatus}
                onChange={(event) => setEngineField("actionableStatus", event.target.value)}
                placeholder="Select Status"
              />
            </Field>

            <Field label="Actionable source">
              <select
                className="input-base"
                value={engineRuleForm.actionableStatusSource}
                onChange={(event) => setEngineField("actionableStatusSource", event.target.value as EngineRuleForm["actionableStatusSource"])}
              >
                <option value="related">Related</option>
                <option value="boat">Boat</option>
                <option value="booking">Booking</option>
                <option value="bid">Bid</option>
                <option value="deal">Deal</option>
              </select>
            </Field>

            <div className="md:col-span-2 xl:col-span-3">
              <Field label="Linked templates">
                <select
                  className="input-base min-h-36"
                  multiple
                  value={engineRuleForm.templateIds}
                  onChange={(event) =>
                    setEngineField(
                      "templateIds",
                      Array.from(event.target.selectedOptions).map((option) => option.value),
                    )
                  }
                >
                  {templateOptions.map((template) => (
                    <option key={template.id} value={String(template.id)}>
                      {template.name} - {template.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={engineRuleForm.isActive}
                onChange={(event) => setEngineField("isActive", event.target.checked)}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={engineRuleForm.actionableRequiresInternalTasksCompleted}
                onChange={(event) => setEngineField("actionableRequiresInternalTasksCompleted", event.target.checked)}
              />
              Internal tasks completed gate
            </label>
            <Button
              type="button"
              className="rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800"
              onClick={() => void saveEngineRule()}
              disabled={savingEngineRule || !engineRuleForm.name.trim() || engineRuleForm.templateIds.length === 0}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {savingEngineRule ? "Saving..." : engineRuleForm.id ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">Configured Automation Rules</h2>
            </div>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={toggleLogs}>
              {logsOpen ? "Hide Logs" : "Show Logs"}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {engineRules.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No rule-engine rules configured yet.
              </p>
            ) : (
              engineRules.map((rule) => (
                <div key={rule.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{rule.name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {rule.internal_code || `RULE-${rule.id}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      rule.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {rule.is_active ? "Active" : "Draft"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-1 text-sm text-slate-600">
                    <p>Trigger: {rule.trigger_event}</p>
                    <p>Audience: {rule.target_role}{rule.target_user_type ? ` / ${rule.target_user_type}` : ""}</p>
                    <p>Visible: {rule.visibility_delay_hours}h{rule.visibility_status ? ` + ${rule.visibility_status}` : ""}</p>
                    <p>Templates: {rule.templates.map((template) => template.title).join(", ") || "None"}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => editEngineRule(rule)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => void deleteEngineRule(rule.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">
                      {triggerEntityMap[rule.trigger_event]?.label ?? "Entity ID"} to simulate
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        className="input-base w-36 py-2 text-sm"
                        type="number"
                        value={simulateEntityId[rule.id] || ""}
                        onChange={(event) =>
                          setSimulateEntityId((current) => ({ ...current, [rule.id]: event.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl border-sky-300 text-sky-700 hover:bg-sky-50"
                        disabled={!simulateEntityId[rule.id] || simulatingRuleId === rule.id}
                        onClick={() => void simulateEngineRule(rule)}
                      >
                        <FlaskConical className="mr-2 h-4 w-4" />
                        {simulatingRuleId === rule.id ? "Simulating..." : "Simulate"}
                      </Button>
                    </div>
                  </div>

                  {simulateResult[rule.id] && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      {simulateResult[rule.id].error ? (
                        <p className="text-rose-600">{simulateResult[rule.id].error}</p>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-700">
                            {simulateResult[rule.id].matched_rules} matched rule(s)
                          </p>
                          {simulateResult[rule.id].preview?.map((preview) => (
                            <div key={preview.rule_id} className="mt-2">
                              <p className="font-semibold text-slate-800">{preview.rule_name}</p>
                              {preview.tasks.map((task, index) => (
                                <p key={index} className="mt-1">
                                  {task.title}
                                  {task.would_skip_duplicate ? " (duplicate skipped)" : ""}
                                </p>
                              ))}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {logsOpen && (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                Execution Logs
              </h3>
              {loadingLogs ? (
                <p className="mt-3 text-sm text-slate-500">Loading logs...</p>
              ) : executionLogs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No logs yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">Rule</th>
                        <th className="pb-2 pr-4">Trigger</th>
                        <th className="pb-2 pr-4">Result</th>
                        <th className="pb-2 pr-4">Reason</th>
                        <th className="pb-2">Tasks</th>
                        <th className="pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executionLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-200/70">
                          <td className="py-2 pr-4">{String(log.created_at || "").slice(0, 19).replace("T", " ")}</td>
                          <td className="py-2 pr-4">{log.rule?.name || log.rule_id || "-"}</td>
                          <td className="py-2 pr-4">{log.trigger_event}</td>
                          <td className="py-2 pr-4">{log.result}</td>
                          <td className="py-2 pr-4">{log.reason || "-"}</td>
                          <td className="py-2">{Array.isArray(log.created_task_ids) ? log.created_task_ids.join(", ") : "-"}</td>
                          <td className="py-2">
                            {log.result === "failed" ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-sky-700 hover:text-sky-600"
                                onClick={() => void retryExecutionLog(Number(log.id))}
                              >
                                Retry
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        .dark .copied-admin-theme section {
          background: rgb(15 23 42 / 0.92) !important;
          border-color: rgb(51 65 85 / 0.9) !important;
        }

        .dark .copied-admin-theme .text-slate-900 {
          color: rgb(241 245 249) !important;
        }

        .dark .copied-admin-theme .text-slate-700,
        .dark .copied-admin-theme .text-slate-600,
        .dark .copied-admin-theme .text-slate-500,
        .dark .copied-admin-theme .text-slate-400 {
          color: rgb(148 163 184) !important;
        }

        .dark .copied-admin-theme .bg-white,
        .dark .copied-admin-theme .bg-white\/90,
        .dark .copied-admin-theme .bg-slate-50,
        .dark .copied-admin-theme .bg-slate-50\/80 {
          background: rgb(15 23 42) !important;
        }

        .dark .copied-admin-theme .border-slate-300,
        .dark .copied-admin-theme .border-slate-200,
        .dark .copied-admin-theme .border-slate-200\/80 {
          border-color: rgb(51 65 85) !important;
        }

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

        .dark .copied-admin-theme .input-base {
          background: rgb(2 6 23);
          border-color: rgb(51 65 85);
          color: rgb(226 232 240);
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
