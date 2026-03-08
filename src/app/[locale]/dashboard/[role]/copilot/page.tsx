"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Play, RefreshCw, ShieldCheck, WandSparkles } from "lucide-react";
import {
  createCopilotAction,
  createCopilotPhrase,
  draftCopilotAction,
  executeCopilotAction,
  getCopilotActionCatalog,
  validateCopilotAction,
  type CopilotActionCatalogResponse,
  type CopilotDraftResponse,
  type CopilotExecuteResponse,
  type CopilotValidateResponse,
} from "@/lib/copilot";
import { getDictionary } from "@/lib/i18n";
import { toast } from "react-hot-toast";

type ApiErrorLike = {
  friendlyMessage?: string;
  response?: { data?: { message?: string } };
};

type CreatedActionLike = {
  id?: number | string;
  copilot_action_id?: number | string;
  data?: { id?: number | string };
};

function getErrorMessage(error: unknown, fallback: string): string {
  const normalized = error as ApiErrorLike;
  return (
    normalized?.friendlyMessage ||
    normalized?.response?.data?.message ||
    fallback
  );
}

export default function AdminCopilotPage() {
  const locale = useLocale();
  const dictionary = getDictionary(locale);
  const t = dictionary.DashboardAdminCopilot;

  const [catalog, setCatalog] = useState<CopilotActionCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [prompt, setPrompt] = useState(t.defaults.prompt);
  const [language, setLanguage] = useState(locale);
  const [topK, setTopK] = useState(5);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftResponse, setDraftResponse] = useState<CopilotDraftResponse | null>(null);

  const [actionId, setActionId] = useState("");
  const [payloadText, setPayloadText] = useState(t.defaults.payload);
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateResponse, setValidateResponse] = useState<CopilotValidateResponse | null>(null);

  const [confirmExecute, setConfirmExecute] = useState(true);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeResponse, setExecuteResponse] = useState<CopilotExecuteResponse | null>(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [creatingPhrase, setCreatingPhrase] = useState(false);

  const [newActionId, setNewActionId] = useState("boat.create");
  const [newActionTitle, setNewActionTitle] = useState(t.defaults.newActionTitle);
  const [newActionModule, setNewActionModule] = useState(t.defaults.newActionModule);
  const [newActionRoute, setNewActionRoute] = useState(t.defaults.newActionRoute);
  const [newActionRisk, setNewActionRisk] = useState("low");
  const [newActionConfirm, setNewActionConfirm] = useState(false);
  const [newActionEnabled, setNewActionEnabled] = useState(true);

  const [phraseActionId, setPhraseActionId] = useState("");
  const [phraseText, setPhraseText] = useState(t.defaults.phraseText);
  const [phraseLanguage, setPhraseLanguage] = useState(locale);
  const [phrasePriority, setPhrasePriority] = useState(90);
  const [phraseEnabled, setPhraseEnabled] = useState(true);

  const selectedAction = useMemo(() => draftResponse?.selected_action ?? null, [draftResponse]);
  const totalActions = catalog?.count ?? catalog?.actions?.length ?? 0;
  const highRiskActions = (catalog?.actions || []).filter(
    (item) => item.security_level?.toLowerCase() === "high",
  ).length;

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const next = await getCopilotActionCatalog();
      setCatalog(next);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t.toasts.loadCatalogFailed));
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDraft = async () => {
    setDraftLoading(true);
    setExecuteResponse(null);
    setValidateResponse(null);
    try {
      const next = await draftCopilotAction({
        prompt,
        language,
        top_k: topK,
        context: { module: "admin" },
      });
      setDraftResponse(next);
      const pickedActionId = next?.selected_action?.action_id || "";
      setActionId(pickedActionId);
      if (next?.selected_action?.params) {
        setPayloadText(JSON.stringify(next.selected_action.params, null, 2));
      }
      toast.success(t.toasts.draftCreated);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t.toasts.draftFailed));
    } finally {
      setDraftLoading(false);
    }
  };

  const handleValidate = async () => {
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payloadText || "{}");
    } catch {
      toast.error(t.toasts.invalidPayloadJson);
      return;
    }

    if (!actionId.trim()) {
      toast.error(t.toasts.actionIdRequired);
      return;
    }

    setValidateLoading(true);
    setExecuteResponse(null);
    try {
      const next = await validateCopilotAction({ action_id: actionId.trim(), payload: parsedPayload });
      setValidateResponse(next);
      toast.success(t.toasts.validationCreated);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t.toasts.validationFailed));
    } finally {
      setValidateLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!validateResponse?.validation_token) {
      toast.error(t.toasts.validateFirst);
      return;
    }

    setExecuteLoading(true);
    try {
      const next = await executeCopilotAction({
        validation_token: validateResponse.validation_token,
        confirm: confirmExecute,
      });
      setExecuteResponse(next);
      toast.success(t.toasts.executed);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t.toasts.executeFailed));
    } finally {
      setExecuteLoading(false);
    }
  };

  const handleCreateAction = async () => {
    if (!newActionId.trim() || !newActionTitle.trim()) {
      toast.error(t.toasts.actionAndTitleRequired);
      return;
    }
    setCreatingAction(true);
    try {
      const created = await createCopilotAction({
        action_id: newActionId.trim(),
        title: newActionTitle.trim(),
        module: newActionModule.trim(),
        route_template: newActionRoute.trim(),
        required_params: [],
        permission_key: null,
        risk_level: newActionRisk,
        confirmation_required: newActionConfirm,
        enabled: newActionEnabled,
      });
      const createdAction = created as CreatedActionLike;
      const returnedId =
        createdAction.id ||
        createdAction.copilot_action_id ||
        createdAction.data?.id;
      if (returnedId) setPhraseActionId(String(returnedId));
      toast.success(t.toasts.actionCreated);
      await loadCatalog();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t.toasts.createActionFailed));
    } finally {
      setCreatingAction(false);
    }
  };

  const handleCreatePhrase = async () => {
    if (!phraseActionId.trim() || !phraseText.trim()) {
      toast.error(t.toasts.phraseFieldsRequired);
      return;
    }
    setCreatingPhrase(true);
    try {
      await createCopilotPhrase({
        copilot_action_id: phraseActionId.trim(),
        phrase: phraseText.trim(),
        language: phraseLanguage,
        priority: phrasePriority,
        enabled: phraseEnabled,
      });
      toast.success(t.toasts.phraseCreated);
      await loadCatalog();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t.toasts.createPhraseFailed));
    } finally {
      setCreatingPhrase(false);
    }
  };

  return (
    <div className="dashboard-page-theme mx-auto w-full max-w-7xl space-y-6 p-4 text-slate-900 md:p-8 dark:text-slate-100">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-[#0b1f3a] via-[#123663] to-[#0a2d50] p-6 text-white md:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">{t.hero.kicker}</p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">{t.hero.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-sky-100/90">{t.hero.description}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={catalogLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 disabled:opacity-60"
          >
            <RefreshCw size={14} className={catalogLoading ? "animate-spin" : ""} />
            {catalogLoading ? t.hero.refreshing : t.hero.refreshCatalog}
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-xs text-sky-100">{t.hero.totalActions}</p>
            <p className="mt-1 text-2xl font-bold">{totalActions}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-xs text-sky-100">{t.hero.highRisk}</p>
            <p className="mt-1 text-2xl font-bold">{highRiskActions}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p className="text-xs text-sky-100">{t.hero.generatedAt}</p>
            <p className="mt-1 text-sm font-semibold">{catalog?.generated_at || "-"}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.catalog.title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.catalog.columns.action}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.catalog.columns.module}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.catalog.columns.security}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.catalog.columns.confirm}</th>
              </tr>
            </thead>
            <tbody>
              {(catalog?.actions || []).map((action) => (
                <tr key={action.action_id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{action.title || action.action_id}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{action.action_id}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{action.module || "-"}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{action.security_level || "-"}</span></td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{action.confirmation_required ? t.catalog.yes : t.catalog.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{t.sections.draftIntent}</h3>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder={t.fields.language} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value) || 5)} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <button type="button" onClick={() => void handleDraft()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003566] px-3 py-2 text-sm font-semibold text-white">
              {draftLoading ? <RefreshCw size={14} className="animate-spin" /> : <WandSparkles size={14} />} {t.actions.draft}
            </button>
          </div>
          {selectedAction ? <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(selectedAction, null, 2)}</pre> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{t.sections.validateExecute}</h3>
          <div className="space-y-3">
            <input value={actionId} onChange={(e) => setActionId(e.target.value)} placeholder={t.fields.actionId} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <textarea value={payloadText} onChange={(e) => setPayloadText(e.target.value)} rows={6} placeholder={t.fields.payload} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void handleValidate()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600 dark:text-slate-100">{validateLoading ? t.actions.validating : t.actions.validate}</button>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-100"><input type="checkbox" checked={confirmExecute} onChange={(e) => setConfirmExecute(e.target.checked)} />{t.fields.confirm}</label>
              <button type="button" onClick={() => void handleExecute()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">{executeLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} {t.actions.execute}</button>
            </div>
            {validateResponse ? <pre className="overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(validateResponse, null, 2)}</pre> : null}
            {executeResponse ? <pre className="overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(executeResponse, null, 2)}</pre> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{t.sections.createAction}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={newActionId} onChange={(e) => setNewActionId(e.target.value)} placeholder={t.fields.actionId} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} placeholder={t.fields.title} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input value={newActionModule} onChange={(e) => setNewActionModule(e.target.value)} placeholder={t.fields.module} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input value={newActionRoute} onChange={(e) => setNewActionRoute(e.target.value)} placeholder={t.fields.routeTemplate} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input value={newActionRisk} onChange={(e) => setNewActionRisk(e.target.value)} placeholder={t.fields.risk} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-100"><input type="checkbox" checked={newActionConfirm} onChange={(e) => setNewActionConfirm(e.target.checked)} />{t.fields.confirm}</label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-100"><input type="checkbox" checked={newActionEnabled} onChange={(e) => setNewActionEnabled(e.target.checked)} />{t.fields.enabled}</label>
          </div>
          <button type="button" onClick={() => void handleCreateAction()} className="mt-4 rounded-xl bg-[#003566] px-4 py-2 text-sm font-semibold text-white">{creatingAction ? t.actions.creating : t.actions.createAction}</button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{t.sections.createPhrase}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={phraseActionId} onChange={(e) => setPhraseActionId(e.target.value)} placeholder={t.fields.copilotActionId} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input value={phraseText} onChange={(e) => setPhraseText(e.target.value)} placeholder={t.fields.phrase} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input value={phraseLanguage} onChange={(e) => setPhraseLanguage(e.target.value)} placeholder={t.fields.language} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input type="number" value={phrasePriority} onChange={(e) => setPhrasePriority(Number(e.target.value) || 90)} placeholder={t.fields.priority} className="rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:text-slate-100"><input type="checkbox" checked={phraseEnabled} onChange={(e) => setPhraseEnabled(e.target.checked)} />{t.fields.enabled}</label>
          </div>
          <button type="button" onClick={() => void handleCreatePhrase()} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{creatingPhrase ? t.actions.creating : t.actions.createPhrase}</button>
        </div>
      </section>
    </div>
  );
}
