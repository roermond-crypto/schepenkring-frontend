"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Globe,
  Loader2,
  Pencil,
  PlusCircle,
  RotateCcw,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  AdminCopilotAction,
  AdminCopilotPhrase,
  CopilotAuditEvent,
  MatchType,
  Paginated,
  createCopilotAction,
  createCopilotPhrase,
  deleteCopilotAction,
  deleteCopilotPhrase,
  getCopilotAuditEvents,
  listCopilotActions,
  listCopilotPhrases,
  resolveCopilot,
  updateCopilotAction,
  updateCopilotPhrase,
} from "@/lib/copilot";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "actions" | "phrases" | "test" | "audit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLORS = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const TARGET_COLORS: Record<string, string> = {
  page: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  modal:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  api: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  search:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  ai: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
};

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <h2 className="text-base font-semibold text-[#0B1F3A] dark:text-slate-100">
        {title}
      </h2>
      {action}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50">
      {text}
    </div>
  );
}

function FormField({
  label,
  children,
  required,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
        {disabled && (
          <span className="ml-1 text-[10px] font-normal text-slate-400">
            (read-only)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CopilotAdminPage() {
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("actions");

  const tabs: { key: Tab; label: string }[] = [
    { key: "actions", label: locale === "nl" ? "Acties" : "Actions" },
    {
      key: "phrases",
      label:
        locale === "nl" ? "Zinnen / Synoniemen" : "Phrases / Synonyms",
    },
    { key: "test", label: locale === "nl" ? "Testconsole" : "Test Console" },
    { key: "audit", label: "Audit" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Toaster position="top-right" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A] dark:text-slate-100">
          Copilot
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {locale === "nl"
            ? "Beheer acties, zinnen en bekijk hoe Copilot commando's verwerkt."
            : "Manage actions, phrases, and see how Copilot processes commands."}
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-white text-[#0B1F3A] shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "actions" && <ActionsTab locale={locale} />}
      {tab === "phrases" && <PhrasesTab locale={locale} />}
      {tab === "test" && <TestTab locale={locale} />}
      {tab === "audit" && <AuditTab locale={locale} />}
    </div>
  );
}

// ─── Actions Tab ──────────────────────────────────────────────────────────────

function ActionsTab({ locale }: { locale: string }) {
  const [actions, setActions] = useState<AdminCopilotAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingAction, setEditingAction] =
    useState<AdminCopilotAction | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCopilotActions();
      setActions(data);
    } catch {
      toast.error("Failed to load actions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (action: AdminCopilotAction) => {
    try {
      const updated = await updateCopilotAction(action.id, {
        enabled: !action.enabled,
      });
      setActions((prev) =>
        prev.map((a) =>
          a.id === action.id ? { ...a, enabled: updated.enabled } : a,
        ),
      );
    } catch {
      toast.error("Failed to update action");
    }
  };

  const handleDelete = async (action: AdminCopilotAction) => {
    if (
      !window.confirm(
        locale === "nl"
          ? `Actie "${action.title}" verwijderen?`
          : `Delete action "${action.title}"?`,
      )
    )
      return;
    try {
      await deleteCopilotAction(action.id);
      setActions((prev) => prev.filter((a) => a.id !== action.id));
      toast.success(locale === "nl" ? "Actie verwijderd" : "Action deleted");
    } catch {
      toast.error("Failed to delete action");
    }
  };

  const filtered = actions.filter(
    (a) =>
      !search ||
      a.action_id.toLowerCase().includes(search.toLowerCase()) ||
      (a.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.module || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <SectionHeader
        title={locale === "nl" ? "Actiecatalogus" : "Action Catalog"}
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00284d]"
          >
            <PlusCircle size={15} />
            {locale === "nl" ? "Nieuwe actie" : "New action"}
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              locale === "nl" ? "Zoek acties..." : "Search actions..."
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <span className="text-xs text-slate-400">
          {filtered.length} {locale === "nl" ? "acties" : "actions"}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          text={
            locale === "nl" ? "Geen acties gevonden." : "No actions found."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {locale === "nl" ? "ID / Titel" : "ID / Title"}
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Module
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {locale === "nl" ? "Risico" : "Risk"}
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {locale === "nl" ? "Actief" : "Enabled"}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map((action) => (
                <tr
                  key={action.id}
                  className="group bg-white transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0B1F3A] dark:text-slate-100">
                      {action.title || action.action_id}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {action.action_id}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {action.module || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {action.target_type ? (
                      <Badge
                        className={TARGET_COLORS[action.target_type] ?? ""}
                      >
                        {action.target_type}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        RISK_COLORS[
                          action.risk_level as keyof typeof RISK_COLORS
                        ] ?? ""
                      }
                    >
                      {action.risk_level}
                    </Badge>
                    {action.confirmation_required && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        ✓ confirm
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleToggle(action)}
                      className={cn(
                        "transition-colors",
                        action.enabled
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-300 dark:text-slate-600",
                      )}
                    >
                      {action.enabled ? (
                        <ToggleRight size={22} />
                      ) : (
                        <ToggleLeft size={22} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingAction(action)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-slate-300 hover:text-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(action)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <ActionFormModal
          locale={locale}
          onClose={() => setShowCreate(false)}
          onSaved={(action) => {
            setActions((prev) => [action, ...prev]);
            setShowCreate(false);
            toast.success(
              locale === "nl" ? "Actie aangemaakt" : "Action created",
            );
          }}
        />
      )}

      {editingAction && (
        <ActionFormModal
          locale={locale}
          existing={editingAction}
          onClose={() => setEditingAction(null)}
          onSaved={(updated) => {
            setActions((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a)),
            );
            setEditingAction(null);
            toast.success(
              locale === "nl" ? "Actie opgeslagen" : "Action saved",
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Action Form Modal ────────────────────────────────────────────────────────

function ActionFormModal({
  locale,
  existing,
  onClose,
  onSaved,
}: {
  locale: string;
  existing?: AdminCopilotAction;
  onClose: () => void;
  onSaved: (action: AdminCopilotAction) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    action_id: existing?.action_id ?? "",
    title: existing?.title ?? "",
    module: existing?.module ?? "",
    target_type: (existing?.target_type ?? "page") as
      | "page"
      | "modal"
      | "api"
      | "search"
      | "ai",
    route_template: existing?.route_template ?? "",
    risk_level: (existing?.risk_level ?? "low") as "low" | "medium" | "high",
    confirmation_required: existing?.confirmation_required ?? false,
    enabled: existing?.enabled ?? true,
    short_description: existing?.short_description ?? "",
  });

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = existing
        ? await updateCopilotAction(existing.id, form)
        : await createCopilotAction(form);
      onSaved(result);
    } catch {
      toast.error(locale === "nl" ? "Opslaan mislukt" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <h3 className="text-base font-semibold text-[#0B1F3A] dark:text-slate-100">
            {existing
              ? locale === "nl"
                ? "Actie bewerken"
                : "Edit action"
              : locale === "nl"
                ? "Nieuwe actie"
                : "New action"}
          </h3>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            <FormField label="Action ID" required disabled={!!existing}>
              <input
                value={form.action_id}
                onChange={(e) => set("action_id", e.target.value)}
                disabled={!!existing}
                required={!existing}
                placeholder="boat.create"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-700"
              />
            </FormField>
            <FormField
              label={locale === "nl" ? "Titel" : "Title"}
              required
            >
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                required
                placeholder={locale === "nl" ? "Naam" : "Name"}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
            <FormField label="Module">
              <input
                value={form.module}
                onChange={(e) => set("module", e.target.value)}
                placeholder="yachts"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
            <FormField label="Target type">
              <select
                value={form.target_type}
                onChange={(e) =>
                  set("target_type", e.target.value as typeof form.target_type)
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="page">page</option>
                <option value="modal">modal</option>
                <option value="api">api</option>
                <option value="search">search</option>
                <option value="ai">ai</option>
              </select>
            </FormField>
            <FormField label="Route template" required>
              <input
                value={form.route_template}
                onChange={(e) => set("route_template", e.target.value)}
                required
                placeholder="/admin/yachts/new"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
            <FormField
              label={locale === "nl" ? "Risiconiveau" : "Risk level"}
            >
              <select
                value={form.risk_level}
                onChange={(e) =>
                  set("risk_level", e.target.value as typeof form.risk_level)
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </FormField>
            <FormField
              label={
                locale === "nl" ? "Korte beschrijving" : "Short description"
              }
            >
              <input
                value={form.short_description}
                onChange={(e) => set("short_description", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.confirmation_required}
                  onChange={(e) =>
                    set("confirmation_required", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                {locale === "nl"
                  ? "Bevestiging vereist"
                  : "Confirmation required"}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => set("enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {locale === "nl" ? "Actief" : "Enabled"}
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              {locale === "nl" ? "Annuleren" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00284d] disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {locale === "nl" ? "Opslaan" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Phrases Tab ──────────────────────────────────────────────────────────────

function PhrasesTab({ locale }: { locale: string }) {
  const [actions, setActions] = useState<AdminCopilotAction[]>([]);
  const [phrases, setPhrases] = useState<AdminCopilotPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActionId, setSelectedActionId] = useState<string>("all");
  const [editingPhrase, setEditingPhrase] =
    useState<AdminCopilotPhrase | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [actionData, phraseData] = await Promise.all([
        listCopilotActions(),
        listCopilotPhrases(),
      ]);
      setActions(actionData);
      setPhrases(phraseData);
    } catch {
      toast.error("Failed to load phrases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (phrase: AdminCopilotPhrase) => {
    if (
      !window.confirm(
        locale === "nl"
          ? `Zin "${phrase.phrase}" verwijderen?`
          : `Delete phrase "${phrase.phrase}"?`,
      )
    )
      return;
    try {
      await deleteCopilotPhrase(phrase.id);
      setPhrases((prev) => prev.filter((p) => p.id !== phrase.id));
      toast.success(locale === "nl" ? "Zin verwijderd" : "Phrase deleted");
    } catch {
      toast.error("Failed to delete phrase");
    }
  };

  const filtered =
    selectedActionId === "all"
      ? phrases
      : phrases.filter(
          (p) => String(p.copilot_action_id) === selectedActionId,
        );

  const grouped = filtered.reduce<Record<number, AdminCopilotPhrase[]>>(
    (acc, phrase) => {
      const key = phrase.copilot_action_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(phrase);
      return acc;
    },
    {},
  );

  return (
    <div>
      <SectionHeader
        title={locale === "nl" ? "Zinnen & Synoniemen" : "Phrases & Synonyms"}
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00284d]"
          >
            <PlusCircle size={15} />
            {locale === "nl" ? "Nieuwe zin" : "New phrase"}
          </button>
        }
      />

      <div className="mb-4">
        <select
          value={selectedActionId}
          onChange={(e) => setSelectedActionId(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-72"
        >
          <option value="all">
            {locale === "nl" ? "Alle acties" : "All actions"}
          </option>
          {actions.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.title || a.action_id}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          text={
            locale === "nl" ? "Geen zinnen gevonden." : "No phrases found."
          }
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([actionId, actionPhrases]) => {
            const action = actions.find((a) => a.id === Number(actionId));
            return (
              <div
                key={actionId}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                    {action?.title || `Action #${actionId}`}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {action?.action_id}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900">
                      <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {locale === "nl" ? "Zin" : "Phrase"}
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {locale === "nl" ? "Taal" : "Language"}
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {locale === "nl" ? "Prioriteit" : "Priority"}
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {locale === "nl" ? "Actief" : "Enabled"}
                      </th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {actionPhrases.map((phrase) => (
                      <tr
                        key={phrase.id}
                        className="group bg-white transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A] dark:text-slate-100">
                          {phrase.phrase}
                        </td>
                        <td className="px-4 py-2.5">
                          {phrase.language ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Globe size={11} />
                              {phrase.language}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-600">
                              any
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                          {phrase.priority ?? 0}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              "inline-block h-2 w-2 rounded-full",
                              phrase.enabled
                                ? "bg-emerald-400"
                                : "bg-slate-300 dark:bg-slate-600",
                            )}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => setEditingPhrase(phrase)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-slate-300 hover:text-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(phrase)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <PhraseFormModal
          locale={locale}
          actions={actions}
          onClose={() => setShowCreate(false)}
          onSaved={(phrase) => {
            setPhrases((prev) => [...prev, phrase]);
            setShowCreate(false);
            toast.success(
              locale === "nl" ? "Zin aangemaakt" : "Phrase created",
            );
          }}
        />
      )}

      {editingPhrase && (
        <PhraseFormModal
          locale={locale}
          actions={actions}
          existing={editingPhrase}
          onClose={() => setEditingPhrase(null)}
          onSaved={(updated) => {
            setPhrases((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            );
            setEditingPhrase(null);
            toast.success(
              locale === "nl" ? "Zin opgeslagen" : "Phrase saved",
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Phrase Form Modal ────────────────────────────────────────────────────────

function PhraseFormModal({
  locale,
  actions,
  existing,
  onClose,
  onSaved,
}: {
  locale: string;
  actions: AdminCopilotAction[];
  existing?: AdminCopilotPhrase;
  onClose: () => void;
  onSaved: (phrase: AdminCopilotPhrase) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    copilot_action_id: existing?.copilot_action_id ?? (actions[0]?.id ?? 0),
    phrase: existing?.phrase ?? "",
    language: existing?.language ?? "nl",
    priority: existing?.priority ?? 50,
    enabled: existing?.enabled ?? true,
  });

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = existing
        ? await updateCopilotPhrase(existing.id, {
            phrase: form.phrase,
            language: form.language,
            priority: form.priority,
            enabled: form.enabled,
          })
        : await createCopilotPhrase(form);
      onSaved(result);
    } catch {
      toast.error(locale === "nl" ? "Opslaan mislukt" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <h3 className="text-base font-semibold text-[#0B1F3A] dark:text-slate-100">
            {existing
              ? locale === "nl"
                ? "Zin bewerken"
                : "Edit phrase"
              : locale === "nl"
                ? "Nieuwe zin"
                : "New phrase"}
          </h3>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-4 px-6 py-5">
            {!existing && (
              <FormField
                label={locale === "nl" ? "Actie" : "Action"}
                required
              >
                <select
                  value={form.copilot_action_id}
                  onChange={(e) =>
                    set("copilot_action_id", Number(e.target.value))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {actions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title || a.action_id}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label={locale === "nl" ? "Zin" : "Phrase"} required>
              <input
                value={form.phrase}
                onChange={(e) => set("phrase", e.target.value)}
                required
                placeholder={locale === "nl" ? "maak boot aan" : "create boat"}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
            <FormField label={locale === "nl" ? "Taal" : "Language"}>
              <select
                value={form.language}
                onChange={(e) => set("language", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="nl">Nederlands (nl)</option>
                <option value="en">English (en)</option>
                <option value="de">Deutsch (de)</option>
                <option value="fr">Français (fr)</option>
              </select>
            </FormField>
            <FormField label={locale === "nl" ? "Prioriteit" : "Priority"}>
              <input
                type="number"
                min={0}
                max={100}
                value={form.priority}
                onChange={(e) => set("priority", Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {locale === "nl" ? "Actief" : "Enabled"}
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              {locale === "nl" ? "Annuleren" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00284d] disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {locale === "nl" ? "Opslaan" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Test Tab ─────────────────────────────────────────────────────────────────

type TestResult = {
  match_type: MatchType | null;
  action_title: string | null;
  action_id: string | null;
  deeplink: string | null;
  suggestions: string[];
  clarifying_question: string | null;
  candidate_count: number;
};

function TestTab({ locale }: { locale: string }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await resolveCopilot({
        text: input,
        source: "chatpage",
        context: { preview_mode: true },
      });

      const topAction = res.actions?.[0] ?? null;
      setResult({
        match_type: res.match_type ?? null,
        action_title:
          topAction?.title ??
          topAction?.label ??
          topAction?.action_id ??
          null,
        action_id: topAction?.action_id ?? null,
        deeplink:
          topAction?.deeplink ?? topAction?.route_template ?? null,
        suggestions: res.suggestions ?? [],
        clarifying_question: res.clarifying_question ?? null,
        candidate_count: res.actions?.length ?? 0,
      });
    } catch {
      toast.error("Test failed");
    } finally {
      setLoading(false);
    }
  };

  const matchBadge = (mt: MatchType | null) => {
    if (!mt || mt === "no_match")
      return (
        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          no_match
        </Badge>
      );
    if (mt === "deterministic")
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          deterministic
        </Badge>
      );
    if (mt === "phrase_match")
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
          phrase_match
        </Badge>
      );
    return (
      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
        {mt}
      </Badge>
    );
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader
        title={locale === "nl" ? "Testconsole" : "Test Console"}
      />
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        {locale === "nl"
          ? "Voer een commando in zoals een gebruiker dat zou typen en bekijk hoe Copilot het verwerkt."
          : "Enter a command as a user would type it and see how Copilot processes it."}
      </p>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          placeholder={
            locale === "nl" ? "Typ een commando..." : "Type a command..."
          }
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#003566] px-5 py-2 text-sm font-semibold text-white hover:bg-[#00284d] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <Search size={14} />
              {locale === "nl" ? "Testen" : "Test"}
            </>
          )}
        </button>
        {result && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setInput("");
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {result && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {locale === "nl" ? "Resultaat" : "Result"}
            </p>
          </div>
          <div className="space-y-3 px-5 py-4">
            <TestRow
              label="Match type"
              value={matchBadge(result.match_type)}
            />
            <TestRow
              label={locale === "nl" ? "Actie gevonden" : "Action found"}
              value={
                result.action_title ? (
                  <span className="flex items-center gap-1.5 font-medium text-[#0B1F3A] dark:text-slate-100">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {result.action_title}
                    <span className="text-xs text-slate-400">
                      ({result.action_id})
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <AlertCircle size={14} className="text-slate-300" />
                    {locale === "nl" ? "Geen" : "None"}
                  </span>
                )
              }
            />
            {result.deeplink && (
              <TestRow
                label="URL"
                value={
                  <span className="break-all font-mono text-xs text-[#003566] dark:text-blue-400">
                    {result.deeplink}
                  </span>
                }
              />
            )}
            {result.candidate_count > 1 && (
              <TestRow
                label={locale === "nl" ? "Kandidaten" : "Candidates"}
                value={
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {result.candidate_count}
                  </span>
                }
              />
            )}
            {result.clarifying_question && (
              <TestRow
                label={locale === "nl" ? "Verduidelijking" : "Clarifying"}
                value={
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    {result.clarifying_question}
                  </span>
                }
              />
            )}
            {result.suggestions.length > 0 && (
              <TestRow
                label={locale === "nl" ? "Suggesties" : "Suggestions"}
                value={
                  <ul className="space-y-0.5">
                    {result.suggestions.map((s) => (
                      <li
                        key={s}
                        className="text-sm text-slate-500 dark:text-slate-400"
                      >
                        → {s}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TestRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-32 shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <div className="flex-1">{value}</div>
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab({ locale }: { locale: string }) {
  const [events, setEvents] = useState<CopilotAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<Omit<Paginated<unknown>, "data"> | null>(
    null,
  );

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getCopilotAuditEvents({ per_page: 30, all: true });
      setEvents((res as Paginated<CopilotAuditEvent>).data ?? []);
      const { current_page, last_page, per_page, total } =
        res as Paginated<CopilotAuditEvent>;
      setMeta({ current_page, last_page, per_page, total });
      setPage(p);
    } catch {
      toast.error("Failed to load audit events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const statusColor = (status: string | null | undefined) => {
    if (!status) return "text-slate-400";
    if (status === "resolved" || status === "opened")
      return "text-emerald-600 dark:text-emerald-400";
    if (status === "no_match" || status === "failed")
      return "text-red-500 dark:text-red-400";
    return "text-slate-500 dark:text-slate-400";
  };

  return (
    <div>
      <SectionHeader
        title="Copilot Audit"
        action={
          <button
            type="button"
            onClick={() => void load(1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
          >
            <RotateCcw size={13} />
            {locale === "nl" ? "Vernieuwen" : "Refresh"}
          </button>
        }
      />

      {meta && (
        <p className="mb-3 text-xs text-slate-400">
          {meta.total} {locale === "nl" ? "events in totaal" : "events total"}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          text={
            locale === "nl"
              ? "Geen audit events gevonden."
              : "No audit events found."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {locale === "nl" ? "Tijdstip" : "Time"}
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {locale === "nl" ? "Invoer" : "Input"}
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {locale === "nl" ? "Actie" : "Action"}
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {locale === "nl" ? "Bron" : "Source"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="bg-white transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(event.created_at).toLocaleString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3 font-medium text-[#0B1F3A] dark:text-slate-100">
                      {event.input_text || (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {event.selected_action_id ? (
                        <span className="inline-flex items-center gap-1">
                          <ChevronRight
                            size={11}
                            className="text-slate-300"
                          />
                          {event.selected_action_id}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          statusColor(event.status),
                        )}
                      >
                        {event.status || "—"}
                      </span>
                      {event.failure_reason && (
                        <p className="text-[10px] text-red-400">
                          {event.failure_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                      {event.source || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.last_page > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => void load(page - 1)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                {locale === "nl" ? "Vorige" : "Previous"}
              </button>
              <span className="text-xs text-slate-400">
                {page} / {meta.last_page}
              </span>
              <button
                type="button"
                disabled={page === meta.last_page}
                onClick={() => void load(page + 1)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                {locale === "nl" ? "Volgende" : "Next"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
