"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const TOPIC_KEYS = [
  "buying",
  "selling",
  "contracts",
  "payments",
  "viewings",
  "documentation",
] as const;

interface SimpleSupportComposerProps {
  onSend: (message: string) => Promise<void>;
  /** Shows the full "need help?" hero + topic list only for the very first
   * conversation — once the user has any conversation, this is just a
   * lightweight composer for starting a new one. */
  hasConversations: boolean;
}

export function SimpleSupportComposer({ onSend, hasConversations }: SimpleSupportComposerProps) {
  const t = useTranslations("DashboardChat");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(message.trim());
      setMessage("");
    } catch {
      setError(t("simple.sendError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
      {!hasConversations && (
        <>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20">
            <MessageCircleQuestion size={36} className="text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-800">{t("simple.emptyTitle")}</h2>
          <p className="mb-6 max-w-md text-sm leading-relaxed text-slate-500">
            {t("simple.emptyDescription")}
          </p>
          <ul className="mb-8 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
            {TOPIC_KEYS.map((topic) => (
              <li
                key={topic}
                className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-left text-sm font-medium text-slate-600"
              >
                {t(`simple.topics.${topic}`)}
              </li>
            ))}
          </ul>
        </>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className="w-full max-w-xl text-left">
        {hasConversations && (
          <p className="mb-3 text-sm font-semibold text-slate-700">{t("simple.newQuestionTitle")}</p>
        )}
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("simple.messagePlaceholder")}
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500"
        />
        {error && (
          <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className={cn(
            "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto",
          )}
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? t("simple.sending") : t("simple.send")}
        </button>
      </form>
    </div>
  );
}
