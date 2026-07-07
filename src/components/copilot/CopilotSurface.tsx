"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Loader2,
  Mic,
  PanelTopOpen,
  Search,
  Settings2,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CopilotAction,
  CopilotResolveResponse,
  getVoiceSettings,
  resolveCopilot,
  trackCopilot,
  updateVoiceSettings,
} from "@/lib/copilot";
import { toast } from "react-hot-toast";

type CopilotSurfaceProps = {
  source: "header" | "chatpage";
  variant?: "compact" | "full";
  className?: string;
};

type VoiceOption = {
  id: string;
  label: string;
  lang: string;
};

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: (
    event: { results: ArrayLike<ArrayLike<{ transcript: string }>> },
  ) => void;
  start: () => void;
};

function compactText(value?: string | null) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function getActionHref(action?: CopilotAction | null) {
  if (!action) return "";
  return (
    action.deeplink ||
    action.route_template ||
    (typeof action.query_template === "string" ? action.query_template : "")
  );
}

function normalizeCopilotHref(rawHref: string) {
  if (!rawHref) return rawHref;
  if (/^https?:\/\//i.test(rawHref)) return rawHref;

  const href = rawHref.startsWith("/") ? rawHref : `/${rawHref}`;
  const localeMatch = href.match(/^\/(en|nl|de|fr)(\/.*|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
  const pathWithoutLocale = localeMatch ? localeMatch[2] || "/" : href;

  if (
    pathWithoutLocale === "/admin" ||
    pathWithoutLocale.startsWith("/admin/") ||
    pathWithoutLocale === "/partner" ||
    pathWithoutLocale.startsWith("/partner/") ||
    pathWithoutLocale === "/chat" ||
    pathWithoutLocale.startsWith("/chat/") ||
    pathWithoutLocale === "/wallet" ||
    pathWithoutLocale.startsWith("/wallet/") ||
    pathWithoutLocale === "/invoice" ||
    pathWithoutLocale.startsWith("/invoice/")
  ) {
    return `${localePrefix}/dashboard${pathWithoutLocale}`;
  }

  return href;
}

export function CopilotSurface({
  source,
  variant = "compact",
  className,
}: CopilotSurfaceProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const copy = useMemo(() => {
    const isNl = locale === "nl";
    const isDe = locale === "de";

    return {
      placeholder:
        variant === "compact"
          ? isNl
            ? "Zoek of vraag Copilot..."
            : isDe
              ? "Suchen oder Copilot fragen..."
              : "Search or ask Copilot..."
          : isNl
            ? "Beschrijf wat je zoekt of wilt openen..."
            : isDe
              ? "Beschreiben Sie, wonach Sie suchen oder was Sie öffnen möchten..."
              : "Describe what you want to find or open...",
      subtitle: isNl
        ? "Slim navigeren, zoeken en procedures uitleggen"
        : isDe
          ? "Intelligente Navigation, Suche und Prozesshilfe"
          : "Smart navigation, search, and process help",
      run: isNl ? "Uitvoeren" : isDe ? "Ausführen" : "Go",
      listening: isNl ? "Luistert..." : isDe ? "Hört zu..." : "Listening...",
      open: isNl ? "Openen" : isDe ? "Öffnen" : "Open",
      settings:
        isNl ? "Steminstellingen" : isDe ? "Stimme" : "Voice Settings",
      ttsEnabled: isNl
        ? "Voorlezen inschakelen"
        : isDe
          ? "Sprachausgabe aktiv"
          : "Enable speech",
      sttLanguage:
        isNl ? "Spraaktaal" : isDe ? "Spracheingabe" : "Speech Language",
      voice: isNl ? "Stem" : isDe ? "Stimme" : "Voice",
      rate: isNl ? "Snelheid" : isDe ? "Geschwindigkeit" : "Rate",
      save: isNl ? "Opslaan" : isDe ? "Speichern" : "Save",
      cancel: isNl ? "Annuleren" : isDe ? "Abbrechen" : "Cancel",
      openPage:
        isNl
          ? "Open Copilot-pagina"
          : isDe
            ? "Copilot-Seite öffnen"
            : "Open Copilot page",
      saved: isNl
        ? "Copilot-steminstellingen opgeslagen."
        : isDe
          ? "Copilot-Stimmeinstellungen gespeichert."
          : "Copilot voice settings saved.",
      resolveFailed: isNl
        ? "Copilot kon geen antwoord ophalen."
        : isDe
          ? "Copilot konnte keine Antwort laden."
          : "Copilot could not resolve this request.",
      confirmTitle:
        isNl
          ? "Bevestig actie"
          : isDe
            ? "Aktion bestätigen"
            : "Confirm action",
      confirmBody: isNl
        ? "Deze actie vraagt om bevestiging. Wil je doorgaan?"
        : isDe
          ? "Diese Aktion erfordert eine Bestätigung. Möchten Sie fortfahren?"
          : "This action requires confirmation. Do you want to continue?",
      go: isNl ? "Doorgaan" : isDe ? "Fortfahren" : "Continue",
      clarify:
        isNl ? "Verduidelijking" : isDe ? "Rückfrage" : "Clarifying question",
      actionFound:
        isNl ? "Actie gevonden" : isDe ? "Aktion gefunden" : "Action found",
      didYouMean:
        isNl ? "Bedoelde je?" : isDe ? "Meinten Sie?" : "Did you mean?",
      noActionFound: isNl
        ? "Geen actie gevonden"
        : isDe
          ? "Keine Aktion gefunden"
          : "No action found",
      trySuggestions: isNl
        ? "Probeer eens:"
        : isDe
          ? "Versuchen Sie:"
          : "Try asking:",
      answers: isNl ? "Antwoorden" : isDe ? "Antworten" : "Answers",
      results: isNl ? "Resultaten" : isDe ? "Ergebnisse" : "Search results",
    };
  }, [locale, variant]);

  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CopilotResolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(variant === "full");
  const [listening, setListening] = useState(false);
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState("default");
  const [sttLanguage, setSttLanguage] = useState(
    locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US",
  );
  const [rate, setRate] = useState(1);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [pendingAction, setPendingAction] = useState<CopilotAction | null>(null);

  const copilotPageHref = useMemo(() => {
    const match = pathname.match(/^\/(en|nl|de|fr)\/dashboard\/([^/]+)/);
    const currentLocale = match?.[1] || locale;
    return `/${currentLocale}/dashboard/admin/copilot`;
  }, [locale, pathname]);

  useEffect(() => {
    let mounted = true;

    const syncVoices = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const next = voices.map((voice) => ({
        id: voice.voiceURI,
        label: `${voice.name} (${voice.lang})`,
        lang: voice.lang,
      }));
      if (mounted) setVoiceOptions(next);
    };

    (async () => {
      try {
        const settings = await getVoiceSettings();
        if (!mounted) return;
        setTtsEnabled(settings.tts_enabled ?? true);
        setSelectedVoiceId(settings.tts_voice_id || "default");
        if (settings.stt_language) setSttLanguage(settings.stt_language);
        if (typeof settings.rate === "number") setRate(settings.rate);
      } catch {
        // fallback to defaults
      }
    })();

    syncVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = syncVoices;
    }

    return () => {
      mounted = false;
    };
  }, [locale]);

  useEffect(() => {
    if (variant !== "compact") return;

    const handleOutside = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [variant]);

  const firstAnswer = useMemo(() => {
    const a = response?.answers?.[0];
    return a ? compactText(a.answer || a.content || a.text) : null;
  }, [response]);

  const speak = (text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis)
      return;
    const content = compactText(text);
    if (!content) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = sttLanguage || "en-US";
    utterance.rate = rate;
    const selectedVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.voiceURI === selectedVoiceId);
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
  };

  const goToHref = async (href: string, action?: CopilotAction | null) => {
    const nextHref = normalizeCopilotHref(href);
    if (!nextHref) return;

    setOpen(false);
    setResponse(null);

    try {
      await trackCopilot({
        source,
        input_text: query,
        selected_action_id: action?.action_id ?? null,
        deeplink_returned: nextHref,
      });
    } catch {
      // ignore
    }

    window.location.assign(nextHref);
  };

  const handleActionClick = (action: CopilotAction) => {
    // AI-type actions have no deeplink; the answer panel already shows the response
    if (action.target_type === "ai") return;

    const href = getActionHref(action);
    if (!href) return;

    if (action.confirmation_required || response?.needs_confirmation) {
      setPendingAction(action);
      return;
    }

    void goToHref(href, action);
  };

  const handleResolve = async (incoming?: string) => {
    const text = compactText(incoming ?? query);
    if (!text) return;

    setLoading(true);
    try {
      const next = await resolveCopilot({
        text,
        source,
        context: { route: pathname, language: locale },
      });
      setResponse(next);

      // Auto-navigate for single low-risk page action (skip AI-type actions — they stay in the panel)
      const singleAction = next.actions.length === 1 ? next.actions[0] : null;
      if (
        singleAction &&
        next.match_type !== "no_match" &&
        singleAction.target_type !== "ai" &&
        (singleAction.risk_level ?? "low") === "low" &&
        !singleAction.confirmation_required &&
        !next.needs_confirmation
      ) {
        const href = getActionHref(singleAction);
        if (href) {
          void goToHref(href, singleAction);
          return;
        }
      }

      // Medium-risk single match → confirmation dialog
      if (
        singleAction &&
        next.match_type !== "no_match" &&
        (singleAction.confirmation_required || next.needs_confirmation)
      ) {
        setPendingAction(singleAction);
        setLoading(false);
        return;
      }

      setOpen(true);
    } catch {
      toast.error(copy.resolveFailed);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const saveVoiceSettings = async () => {
    try {
      await updateVoiceSettings({
        tts_enabled: ttsEnabled,
        tts_voice_id: selectedVoiceId === "default" ? null : selectedVoiceId,
        stt_language: sttLanguage,
        rate,
      });
      toast.success(copy.saved);
      setVoiceSettingsOpen(false);
    } catch {
      toast.error(copy.resolveFailed);
    }
  };

  const startListening = () => {
    if (typeof window === "undefined") return;

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error(copy.resolveFailed);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = sttLanguage || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = compactText(event?.results?.[0]?.[0]?.transcript);
      if (transcript) {
        setQuery(transcript);
        void handleResolve(transcript);
      }
    };
    recognition.start();
  };

  // ── Panel body ──────────────────────────────────────────────────────────────

  const renderActionFeedback = () => {
    if (!response) return null;

    const { actions, match_type, suggestions = [], clarifying_question } = response;

    // Clarifying question (from AI)
    const clarifySection = clarifying_question ? (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-900/20">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700 dark:text-amber-400">
            {copy.clarify}
          </p>
          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-200">
            {clarifying_question}
          </p>
        </div>
      </div>
    ) : null;

    // No match
    if (match_type === "no_match" || actions.length === 0) {
      return (
        <>
          {clarifySection}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {copy.noActionFound}
              </p>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                  {copy.trySuggestions}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(s);
                          void handleResolve(s);
                        }}
                        className="group flex items-center gap-2 text-sm text-[#003566] hover:underline dark:text-blue-400"
                      >
                        <span className="text-slate-400 group-hover:text-[#003566] dark:group-hover:text-blue-400">
                          →
                        </span>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      );
    }

    // Single action
    if (actions.length === 1) {
      const action = actions[0];
      return (
        <>
          {clarifySection}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 dark:border-emerald-800/60 dark:bg-emerald-900/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                    {copy.actionFound}
                  </p>
                  <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                    {action.title || action.label || action.action_id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleActionClick(action)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#003566] px-3 py-2 text-xs font-semibold text-white hover:bg-[#00284d] dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                {copy.open}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {(action.description || action.reason) && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 pl-6">
                {action.description || action.reason}
              </p>
            )}
          </div>
        </>
      );
    }

    // Multiple candidates → "Did you mean?"
    return (
      <>
        {clarifySection}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4 dark:border-blue-900/40 dark:bg-blue-900/10">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-blue-700 dark:text-blue-400">
            <HelpCircle className="h-3.5 w-3.5" />
            {copy.didYouMean}
          </p>
          <div className="mt-3 space-y-2">
            {actions.slice(0, 5).map((action, i) => (
              <button
                key={`${action.action_id || "a"}-${i}`}
                type="button"
                onClick={() => handleActionClick(action)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-[#0B1F3A] dark:text-slate-100">
                    {action.title || action.label || action.action_id}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderAnswers = () => {
    if (!response?.answers.length) return null;
    return (
      <div className="mt-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          {copy.answers}
        </p>
        {response.answers.map((answer, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/70"
          >
            {answer.title && (
              <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                {answer.title}
              </p>
            )}
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {answer.answer || answer.content || answer.text}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderResults = () => {
    if (!response?.results.length) return null;
    return (
      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          {copy.results} ({response.results.length})
        </p>
        {response.results.map((result, i) => (
          <button
            key={`${result.type || "r"}-${result.id || i}`}
            type="button"
            onClick={() => result.deeplink && void goToHref(result.deeplink)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <span className="text-sm text-[#0B1F3A] dark:text-slate-100">
              {result.title ||
                `${result.type || "Result"} #${result.id || "—"}`}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          </button>
        ))}
      </div>
    );
  };

  const panel = (
    <div
      className={cn(
        variant === "compact"
          ? "absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[min(46rem,calc(100vw-2rem))]"
          : "w-full",
      )}
    >
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#F8FBFF] to-[#EFF6FF] px-5 py-4 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#003566] text-white shadow-sm">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                  Schepenkring Copilot
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {copy.subtitle}
                </p>
              </div>
            </div>
            {firstAnswer && (
              <button
                type="button"
                onClick={() => speak(firstAnswer)}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Volume2 className="mr-2 h-3.5 w-3.5" /> TTS
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[30rem] overflow-y-auto px-5 py-5">
          {renderActionFeedback()}
          {renderAnswers()}
          {renderResults()}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={panelRef} className={cn("relative", className)}>
      {/* Input bar */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-[1.35rem] border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors focus-within:border-[#003566] dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-400",
          variant === "compact"
            ? "min-w-[18rem] md:w-[26rem]"
            : "w-full px-4 py-3",
        )}
      >
        <Search
          size={16}
          className="shrink-0 text-slate-400 dark:text-slate-500"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (response) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleResolve();
            }
            if (event.key === "Escape") {
              setOpen(false);
              setResponse(null);
            }
          }}
          placeholder={copy.placeholder}
          className={cn(
            "flex-1 border-none bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500",
            variant === "compact"
              ? "text-[11px] font-bold uppercase tracking-[0.18em] text-[#003566] dark:text-slate-100"
              : "text-sm text-[#0B1F3A] dark:text-slate-100",
          )}
        />
        <button
          type="button"
          onClick={startListening}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            listening
              ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
          )}
          aria-label={copy.listening}
        >
          <Mic size={16} />
        </button>
        <button
          type="button"
          onClick={() => setVoiceSettingsOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600"
          aria-label={copy.settings}
        >
          <Settings2 size={16} />
        </button>
        <Button
          type="button"
          onClick={() => void handleResolve()}
          disabled={loading || !compactText(query)}
          className={cn(
            "rounded-xl bg-[#003566] text-white hover:bg-[#00284d]",
            variant === "compact" ? "h-9 px-3 text-[10px]" : "h-10 px-4 text-xs",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            copy.run
          )}
        </Button>
      </div>

      {/* Panel */}
      {(variant === "full" || (open && response)) && panel}

      {/* Voice settings dialog */}
      <Dialog open={voiceSettingsOpen} onOpenChange={setVoiceSettingsOpen}>
        <DialogContent className="max-w-xl rounded-[1.75rem] border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-900">
          <div className="rounded-t-[1.5rem] bg-gradient-to-r from-white via-[#F8FBFF] to-[#EFF6FF] px-6 py-5 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <DialogHeader className="!rounded-t-[1.5rem]">
              <DialogTitle className="text-xl text-[#0B1F3A] dark:text-slate-100">
                {copy.settings}
              </DialogTitle>
              <DialogDescription>{copy.subtitle}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-6">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <span className="text-sm font-medium text-[#0B1F3A] dark:text-slate-100">
                {copy.ttsEnabled}
              </span>
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(event) => setTtsEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {copy.sttLanguage}
              </p>
              <select
                value={sttLanguage}
                onChange={(e) => setSttLanguage(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="en-US">English</option>
                <option value="nl-NL">Nederlands</option>
                <option value="de-DE">Deutsch</option>
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {copy.voice}
              </p>
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="default">System Default</option>
                {voiceOptions.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {copy.rate}
              </span>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                className="w-full accent-[#003566]"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {rate.toFixed(2)}x
              </span>
            </label>
          </div>
          <DialogFooter className="border-t border-slate-100 px-6 py-5 dark:border-slate-700">
            <Button asChild type="button" variant="outline" className="rounded-2xl">
              <a href={copilotPageHref} className="inline-flex items-center gap-2">
                <PanelTopOpen size={14} />
                {copy.openPage}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVoiceSettingsOpen(false)}
              className="rounded-2xl"
            >
              {copy.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => void saveVoiceSettings()}
              className="rounded-2xl bg-[#003566] hover:bg-[#00284d]"
            >
              {copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={() => setPendingAction(null)}
      >
        <DialogContent className="max-w-lg rounded-[1.5rem] border-slate-200 dark:border-slate-700 dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>{copy.confirmTitle}</DialogTitle>
            <DialogDescription>
              {pendingAction?.title && (
                <span className="font-semibold text-[#0B1F3A] dark:text-slate-100">
                  {pendingAction.title}
                </span>
              )}
              {" — "}
              {copy.confirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingAction(null)}
            >
              {copy.cancel}
            </Button>
            <Button
              onClick={() => {
                const href = getActionHref(pendingAction);
                const action = pendingAction;
                setPendingAction(null);
                if (href) void goToHref(href, action);
              }}
              className="bg-[#003566] hover:bg-[#00284d]"
            >
              {copy.go}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
