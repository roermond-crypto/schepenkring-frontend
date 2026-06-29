"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import {
  Globe,
  Sparkles,
  Loader2,
  Volume2,
} from "lucide-react";

interface Step3Locale {
  aiTone: string; minWords: string; maxWords: string; regenerate: string;
  stopRecording: string; startDictation: string; defaultVoice: string;
  stopAudio: string; playAudio: string; editorPlaceholder: string;
  tones: Record<string, string>;
}
const STEP3_TEXT: Record<string, Step3Locale> = {
  nl: {
    aiTone: "AI Toon",
    minWords: "Min. woorden",
    maxWords: "Max. woorden",
    regenerate: "Opnieuw genereren",
    stopRecording: "Opname stoppen",
    startDictation: "Dicteren starten",
    defaultVoice: "Standaardstem",
    stopAudio: "Audio stoppen",
    playAudio: "Audio afspelen",
    editorPlaceholder: "Bekijk en bewerk de door AI gegenereerde beschrijving hier...",
    tones: { professional: "Professioneel", enthusiastic: "Enthousiast", luxurious: "Luxueus", concise: "Beknopt & Direct", storytelling: "Verhaalvertelling" },
  },
  en: {
    aiTone: "AI Tone",
    minWords: "Min Words",
    maxWords: "Max Words",
    regenerate: "Regenerate",
    stopRecording: "Stop recording",
    startDictation: "Start dictation",
    defaultVoice: "Default Voice",
    stopAudio: "Stop Audio",
    playAudio: "Play Audio",
    editorPlaceholder: "Review and edit the AI-generated description here...",
    tones: { professional: "Professional", enthusiastic: "Enthusiastic", luxurious: "Luxurious", concise: "Concise & Direct", storytelling: "Storytelling" },
  },
  de: {
    aiTone: "KI-Ton",
    minWords: "Min. Wörter",
    maxWords: "Max. Wörter",
    regenerate: "Neu generieren",
    stopRecording: "Aufnahme stoppen",
    startDictation: "Diktat starten",
    defaultVoice: "Standardstimme",
    stopAudio: "Audio stoppen",
    playAudio: "Audio abspielen",
    editorPlaceholder: "KI-generierte Beschreibung hier überprüfen und bearbeiten...",
    tones: { professional: "Professionell", enthusiastic: "Enthusiastisch", luxurious: "Luxuriös", concise: "Prägnant & Direkt", storytelling: "Storytelling" },
  },
  fr: {
    aiTone: "Ton IA",
    minWords: "Min. mots",
    maxWords: "Max. mots",
    regenerate: "Régénérer",
    stopRecording: "Arrêter l'enregistrement",
    startDictation: "Démarrer la dictée",
    defaultVoice: "Voix par défaut",
    stopAudio: "Arrêter l'audio",
    playAudio: "Lire l'audio",
    editorPlaceholder: "Examinez et modifiez la description générée par l'IA ici...",
    tones: { professional: "Professionnel", enthusiastic: "Enthousiaste", luxurious: "Luxueux", concise: "Concis & Direct", storytelling: "Narration" },
  },
};
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WizardInput as Input } from "./WizardHelpers";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { toast } from "sonner";
import {
  DESCRIPTION_LANGS,
  DESCRIPTION_LANGUAGE_BADGES,
  DESCRIPTION_LANGUAGE_LABELS,
  DESCRIPTION_LANGUAGE_LOCALES,
  type DescriptionLanguage,
  type DescriptionTextState
} from "./WizardHelpers";

interface WizardStep3Props {
  selectedLang: DescriptionLanguage;
  setSelectedLang: (lang: DescriptionLanguage) => void;
  aiTone: string;
  setAiTone: (tone: string) => void;
  aiMinWords: any;
  setAiMinWords: (words: any) => void;
  aiMaxWords: any;
  setAiMaxWords: (words: any) => void;
  aiTexts: DescriptionTextState;
  setAiTexts: React.Dispatch<React.SetStateAction<DescriptionTextState>>;
  isRegenerating: boolean;
  handleRegenerateDescription: () => Promise<void>;
  isDictating: boolean;
  toggleDictation: () => void;
  selectedVoice: string;
  setSelectedVoice: (voice: string) => void;
  isPlayingAudio: boolean;
  setIsPlayingAudio: (playing: boolean) => void;
  voices: SpeechSynthesisVoice[];
  labelText: (key: any, fallback: string) => any;
}

export function WizardStep3({
  selectedLang,
  setSelectedLang,
  aiTone,
  setAiTone,
  aiMinWords,
  setAiMinWords,
  aiMaxWords,
  setAiMaxWords,
  aiTexts,
  setAiTexts,
  isRegenerating,
  handleRegenerateDescription,
  isDictating,
  toggleDictation,
  selectedVoice,
  setSelectedVoice,
  isPlayingAudio,
  setIsPlayingAudio,
  voices,
  labelText,
}: WizardStep3Props) {
  const locale = useLocale();
  const tx = STEP3_TEXT[locale] ?? STEP3_TEXT.en;
  const tones = (STEP3_TEXT[locale] ?? STEP3_TEXT.en).tones;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-8">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Globe size={18} className="text-blue-500" />{" "}
          {labelText("vesselDescription", "Vessel Description")}
        </h3>

        {/* Language Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-sm gap-1">
          {DESCRIPTION_LANGS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setSelectedLang(lang)}
              className={cn(
                "px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                selectedLang === lang
                  ? "bg-white text-[#003566] shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200",
              )}
            >
              {DESCRIPTION_LANGUAGE_BADGES[lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-wrap items-end gap-5">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-bold text-slate-500 uppercase block">
              {tx.aiTone}
            </label>
            <select
              className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 shadow-sm mt-1 focus:border-blue-500 focus:outline-none"
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value)}
            >
              <option value="professional">{tones.professional}</option>
              <option value="enthusiastic">{tones.enthusiastic}</option>
              <option value="luxurious">{tones.luxurious}</option>
              <option value="concise">{tones.concise}</option>
              <option value="storytelling">{tones.storytelling}</option>
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs font-bold text-slate-500 uppercase block">
              {tx.minWords}
            </label>
            <Input
              type="number"
              className="mt-1"
              value={aiMinWords}
              onChange={(e) =>
                setAiMinWords(parseInt(e.target.value) || 200)
              }
            />
          </div>
          <div className="w-24">
            <label className="text-xs font-bold text-slate-500 uppercase block">
              {tx.maxWords}
            </label>
            <Input
              type="number"
              className="mt-1"
              value={aiMaxWords}
              onChange={(e) =>
                setAiMaxWords(parseInt(e.target.value) || 500)
              }
            />
          </div>
          <Button
            type="button"
            onClick={() => handleRegenerateDescription()}
            disabled={isRegenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 mt-1 h-9"
          >
            {isRegenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {tx.regenerate}
          </Button>
        </div>

        <div className="flex justify-between items-center pt-2">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
            {DESCRIPTION_LANGUAGE_LABELS[selectedLang]}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDictation}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                isDictating
                  ? "bg-red-100 text-red-600 animate-pulse"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
              title={isDictating ? tx.stopRecording : tx.startDictation}
            >
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  isDictating ? "bg-red-600" : "bg-slate-600",
                )}
              />
            </button>

            <div className="flex items-center gap-2">
              <select
                className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1 max-w-[150px] truncate"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
              >
                <option value="">{tx.defaultVoice}</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if ("speechSynthesis" in window) {
                    if (window.speechSynthesis.speaking) {
                      window.speechSynthesis.cancel();
                      setIsPlayingAudio(false);
                      return;
                    }

                    const utterance = new SpeechSynthesisUtterance(
                      aiTexts[selectedLang],
                    );
                    if (selectedVoice) {
                      const voice = voices.find(
                        (v) => v.name === selectedVoice,
                      );
                      if (voice) utterance.voice = voice;
                    } else {
                      utterance.lang =
                        DESCRIPTION_LANGUAGE_LOCALES[selectedLang];
                    }

                    utterance.onend = () => setIsPlayingAudio(false);
                    utterance.onerror = () =>
                      setIsPlayingAudio(false);

                    window.speechSynthesis.speak(utterance);
                    setIsPlayingAudio(true);
                  } else {
                    toast.error(
                      "Text-to-speech not supported in this browser.",
                    );
                  }
                }}
                className={cn(
                  "flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors",
                  isPlayingAudio
                    ? "text-red-700 bg-red-50 hover:bg-red-100"
                    : "text-[#003566] bg-blue-50 hover:bg-blue-100",
                )}
              >
                {isPlayingAudio ? (
                  <>
                    <div className="w-2 h-2 bg-red-600 rounded-sm animate-pulse" />{" "}
                    {tx.stopAudio}
                  </>
                ) : (
                  <>
                    <Volume2 size={12} /> {tx.playAudio}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        <RichTextEditor
          content={aiTexts[selectedLang]}
          onChange={(html) =>
            setAiTexts((prev) => ({ ...prev, [selectedLang]: html }))
          }
          placeholder={tx.editorPlaceholder}
        />
      </div>
    </div>
  );
}
