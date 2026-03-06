"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronRight,
  Loader2,
  Mic,
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

  if (/^https?:\/\//i.test(rawHref)) {
    return rawHref;
  }

  const href = rawHref.startsWith("/") ? rawHref : `/${rawHref}`;

  const localeMatch = href.match(/^\/(en|nl|de)(\/.*|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
  const pathWithoutLocale = localeMatch ? localeMatch[2] || "/" : href;

  if (
    pathWithoutLocale === "/admin" ||
    pathWithoutLocale.startsWith("/admin/")
  ) {
    return `${localePrefix}/dashboard${pathWithoutLocale}`;
  }

  if (
    pathWithoutLocale === "/partner" ||
    pathWithoutLocale.startsWith("/partner/")
  ) {
    return `${localePrefix}/dashboard${pathWithoutLocale}`;
  }

  if (
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
        ? "Slim zoeken, navigeren en procedures uitleggen"
        : isDe
          ? "Intelligente Suche, Navigation und Prozesshilfe"
          : "Smart search, navigation, and process help",
      run: isNl ? "Uitvoeren" : isDe ? "Ausführen" : "Resolve",
      listening: isNl ? "Luistert..." : isDe ? "Hört zu..." : "Listening...",
      actions: isNl ? "Acties" : isDe ? "Aktionen" : "Actions",
      results: isNl ? "Resultaten" : isDe ? "Ergebnisse" : "Results",
      answers: isNl ? "Antwoorden" : isDe ? "Antworten" : "Answers",
      noActions: isNl
        ? "Geen aanbevolen acties gevonden."
        : isDe
          ? "Keine empfohlenen Aktionen gefunden."
          : "No recommended actions found.",
      noResults: isNl
        ? "Geen zoekresultaten gevonden."
        : isDe
          ? "Keine Suchergebnisse gefunden."
          : "No search results found.",
      noAnswers: isNl
        ? "Nog geen antwoord beschikbaar."
        : isDe
          ? "Noch keine Antwort verfügbar."
          : "No answer available yet.",
      why: isNl ? "Waarom" : isDe ? "Warum" : "Why",
      confidence: isNl ? "Vertrouwen" : isDe ? "Vertrauen" : "Confidence",
      open: isNl ? "Openen" : isDe ? "Öffnen" : "Open",
      settings: isNl ? "Steminstellingen" : isDe ? "Stimme" : "Voice Settings",
      ttsEnabled: isNl
        ? "Voorlezen inschakelen"
        : isDe
          ? "Sprachausgabe aktiv"
          : "Enable speech",
      sttLanguage: isNl ? "Spraaktaal" : isDe ? "Spracheingabe" : "Speech Language",
      voice: isNl ? "Stem" : isDe ? "Stimme" : "Voice",
      rate: isNl ? "Snelheid" : isDe ? "Geschwindigkeit" : "Rate",
      save: isNl ? "Opslaan" : isDe ? "Speichern" : "Save",
      cancel: isNl ? "Annuleren" : isDe ? "Abbrechen" : "Cancel",
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
      confirmTitle: isNl ? "Bevestig navigatie" : isDe ? "Navigation bestätigen" : "Confirm navigation",
      confirmBody: isNl
        ? "Deze actie vraagt om bevestiging. Wil je doorgaan?"
        : isDe
          ? "Diese Aktion erfordert eine Bestätigung. Möchten Sie fortfahren?"
          : "This action requires confirmation. Do you want to continue?",
      go: isNl ? "Doorgaan" : isDe ? "Fortfahren" : "Continue",
      clarify: isNl ? "Verduidelijking" : isDe ? "Rückfrage" : "Clarifying Question",
    };
  }, [locale, variant]);

  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CopilotResolveResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"actions" | "results" | "answers">("actions");
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
        // fallback
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

  const answerToRead = useMemo(() => {
    const first = response?.answers?.[0];
    return compactText(first?.answer || first?.content || first?.text);
  }, [response]);

  const speak = (text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
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

  const handleResolve = async (incoming?: string) => {
    const text = compactText(incoming ?? query);
    if (!text) return;

    setLoading(true);
    setOpen(true);
    try {
      const next = await resolveCopilot({
        text,
        source,
        context: { route: pathname, language: locale },
      });
      setResponse(next);

      if (next.actions.length > 0) setActiveTab("actions");
      else if (next.results.length > 0) setActiveTab("results");
      else if (next.answers.length > 0) setActiveTab("answers");
    } catch {
      toast.error(copy.resolveFailed);
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
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };

    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
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
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = compactText(event?.results?.[0]?.[0]?.transcript);
      if (transcript) {
        setQuery(transcript);
        setOpen(true);
      }
    };
    recognition.start();
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

    if (/^https?:\/\//i.test(nextHref)) {
      window.location.assign(nextHref);
      return;
    }

    window.location.assign(nextHref);
  };

  const handleActionClick = (action: CopilotAction) => {
    const href = getActionHref(action);
    if (!href) return;

    if (action.confirmation_required || response?.needs_confirmation) {
      setPendingAction(action);
      return;
    }

    void goToHref(href, action);
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
        <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#F8FBFF] to-[#EFF6FF] px-5 py-4 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#003566] text-white shadow-sm">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">NauticSecure Copilot</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
              </div>
            </div>
            {answerToRead && (
              <button
                type="button"
                onClick={() => speak(answerToRead)}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#003566] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Volume2 className="mr-2 h-3.5 w-3.5" /> TTS
              </button>
            )}
          </div>

          {response?.clarifying_question && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">{copy.clarify}</p>
              <p className="mt-1">{response.clarifying_question}</p>
            </div>
          )}

          {typeof response?.confidence === "number" && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {copy.confidence}: {Math.round(response.confidence * 100)}%
            </p>
          )}
        </div>

        <div className="px-5 py-5">
          <div className="mb-4 grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
            {(["actions", "results", "answers"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-xl px-2 py-2 text-xs font-semibold",
                  activeTab === tab
                    ? "bg-white text-[#0B1F3A] dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                {tab === "actions" ? copy.actions : tab === "results" ? copy.results : copy.answers}
              </button>
            ))}
          </div>

          <div className="max-h-[26rem] overflow-y-auto pr-1">
            {activeTab === "actions" && (
              <div className="space-y-3">
                {response?.actions.length ? (
                  response.actions.map((action, index) => (
                    <button
                      key={`${action.action_id || "action"}-${index}`}
                      type="button"
                      onClick={() => handleActionClick(action)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                            {action.title || action.label || action.action_id || copy.open}
                          </p>
                          {(action.description || action.reason) && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {action.description || action.reason}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {copy.noActions}
                  </div>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div className="space-y-3">
                {response?.results.length ? (
                  response.results.map((result, index) => (
                    <button
                      key={`${result.type || "result"}-${result.id || index}`}
                      type="button"
                      onClick={() => result.deeplink && goToHref(result.deeplink)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="mt-1 text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                            {result.title || `${result.type || "Result"} #${result.id || "—"}`}
                          </p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {copy.noResults}
                  </div>
                )}
              </div>
            )}

            {activeTab === "answers" && (
              <div className="space-y-3">
                {response?.answers.length ? (
                  response.answers.map((answer, index) => (
                    <div
                      key={`answer-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/70"
                    >
                      <p className="text-sm font-semibold text-[#0B1F3A] dark:text-slate-100">
                        {answer.title || copy.answers}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {answer.answer || answer.content || answer.text || copy.noAnswers}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {copy.noAnswers}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={panelRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-[1.35rem] border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors focus-within:border-[#003566] dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-blue-400",
          variant === "compact" ? "min-w-[18rem] md:w-[26rem]" : "w-full px-4 py-3",
        )}
      >
        <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleResolve();
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.run}
        </Button>
      </div>

      {(variant === "full" || (open && (response || loading || query))) && panel}

      <Dialog open={voiceSettingsOpen} onOpenChange={setVoiceSettingsOpen}>
        <DialogContent className="max-w-xl rounded-[1.75rem] border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-900">
          <div className="rounded-t-[1.5rem] bg-gradient-to-r from-white via-[#F8FBFF] to-[#EFF6FF] px-6 py-5 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <DialogHeader className="!rounded-t-[1.5rem]">
              <DialogTitle className="text-xl text-[#0B1F3A] dark:text-slate-100">{copy.settings}</DialogTitle>
              <DialogDescription>{copy.subtitle}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-6">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <span className="text-sm font-medium text-[#0B1F3A] dark:text-slate-100">{copy.ttsEnabled}</span>
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(event) => setTtsEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{copy.sttLanguage}</p>
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
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{copy.voice}</p>
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
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{copy.rate}</span>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                className="w-full accent-[#003566]"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">{rate.toFixed(2)}x</span>
            </label>
          </div>
          <DialogFooter className="border-t border-slate-100 px-6 py-5 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => setVoiceSettingsOpen(false)} className="rounded-2xl">
              {copy.cancel}
            </Button>
            <Button type="button" onClick={() => void saveVoiceSettings()} className="rounded-2xl bg-[#003566] hover:bg-[#00284d]">
              {copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingAction)} onOpenChange={() => setPendingAction(null)}>
        <DialogContent className="max-w-lg rounded-[1.5rem] border-slate-200 dark:border-slate-700 dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>{copy.confirmTitle}</DialogTitle>
            <DialogDescription>{copy.confirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingAction(null)}>
              {copy.cancel}
            </Button>
            <Button
              onClick={() => {
                const href = getActionHref(pendingAction);
                const action = pendingAction;
                setPendingAction(null);
                if (href) {
                  void goToHref(href, action);
                }
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
